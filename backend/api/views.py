from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    User,
    Local,
    Product,
    ProductCategory,
    Order,
    OrderItem,
    Reward,
    PointBalance,
    Redemption,
    Notification,
)
from .serializers import (
    UserSerializer,
    LocalSerializer,
    ProductSerializer,
    ProductCategorySerializer,
    OrderSerializer,
    OrderItemReadSerializer,
    RewardSerializer,
    PointBalanceSerializer,
    RedemptionSerializer,
    NotificationSerializer,
)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        if self.action == "create":
            return [permissions.AllowAny()]
        return super().get_permissions()


class LocalViewSet(viewsets.ModelViewSet):
    queryset = Local.objects.select_related("owner").all()
    serializer_class = LocalSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related("local", "category").all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(description__icontains=search)
                | Q(category__name__icontains=search)
            )

        category_id = params.get("category")
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        local_id = params.get("local")
        if local_id:
            queryset = queryset.filter(local_id=local_id)

        stock_state = params.get("stock_state")
        if stock_state:
            state_filter = self._build_stock_state_filter(stock_state)
            if state_filter is not None:
                queryset = queryset.filter(state_filter)

        in_stock = params.get("in_stock")
        if in_stock:
            if in_stock.lower() == "true":
                queryset = queryset.filter(in_stock=True)
            elif in_stock.lower() == "false":
                queryset = queryset.filter(in_stock=False)

        ordering = params.get("ordering")
        if ordering:
            queryset = queryset.order_by(*ordering.split(","))
        else:
            queryset = queryset.order_by("category_id", "display_order", "name")

        return queryset

    @staticmethod
    def _build_stock_state_filter(value: str):
        state = value.lower()
        if state == "low":
            return (
                Q(tracks_stock=True)
                & Q(stock__gt=F("critical_stock_threshold"))
                & Q(stock__lte=F("low_stock_threshold"))
                & Q(stock__gt=0)
            )
        if state == "critical":
            return (
                Q(tracks_stock=True)
                & Q(stock__gt=0)
                & Q(stock__lte=F("critical_stock_threshold"))
            )
        if state == "out":
            return (
                Q(tracks_stock=True, stock__lte=0)
                | Q(tracks_stock=False, in_stock=False)
            )
        if state == "available":
            return Q(tracks_stock=False, in_stock=True)
        if state == "normal":
            return (
                Q(tracks_stock=True)
                & Q(stock__gt=F("low_stock_threshold"))
            )
        return None

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="reorder")
    def reorder(self, request):
        category_id = request.data.get("category")
        order = request.data.get("order", [])

        if not category_id:
            return Response({"detail": "category es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(order, list) or not all(isinstance(item, int) for item in order):
            return Response({"detail": "order debe ser una lista de IDs numéricos."}, status=status.HTTP_400_BAD_REQUEST)

        products = Product.objects.filter(category_id=category_id, id__in=order)
        if products.count() != len(order):
            return Response({"detail": "Algunos productos no pertenecen a la categoría indicada."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for index, product_id in enumerate(order):
                Product.objects.filter(id=product_id).update(display_order=index)

        return Response({"detail": "Orden actualizado."}, status=status.HTTP_200_OK)


class ProductCategoryViewSet(viewsets.ModelViewSet):
    queryset = ProductCategory.objects.select_related("local").all()
    serializer_class = ProductCategorySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        local_id = self.request.query_params.get("local")

        if local_id:
            return queryset.filter(local_id=local_id)

        if self.request.user.is_authenticated:
            user_local_ids = Local.objects.filter(owner=self.request.user).values_list("id", flat=True)
            return queryset.filter(local_id__in=user_local_ids)

        return queryset.none()


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        base_queryset = Notification.objects.select_related("product", "local").order_by("-created_at")
        user = self.request.user
        if not user.is_authenticated:
            return Notification.objects.none()

        if user.is_superuser or getattr(user, "role", None) == User.Roles.ADMIN:
            return base_queryset

        local_ids = Local.objects.filter(owner=user).values_list("id", flat=True)
        return base_queryset.filter(Q(local_id__in=local_ids) | Q(user=user))

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.mark_as_read()
        serializer = self.get_serializer(notification)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        queryset = self.get_queryset().filter(is_read=False)
        updated = queryset.update(is_read=True, read_at=timezone.now())
        return Response({"updated": updated})


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.select_related("user", "local").prefetch_related("items__product").all()
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def update_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get("status")
        valid_status = dict(Order.Status.choices)
        if new_status not in valid_status:
            return Response({"detail": "Estado inválido."}, status=400)
        order.update_status(new_status)
        return Response({"status": order.status})


class OrderItemViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = OrderItem.objects.select_related("order", "product").all()
    serializer_class = OrderItemReadSerializer
    permission_classes = [permissions.IsAuthenticated]


class RewardViewSet(viewsets.ModelViewSet):
    queryset = Reward.objects.select_related("local").all()
    serializer_class = RewardSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class PointBalanceViewSet(viewsets.ModelViewSet):
    queryset = PointBalance.objects.select_related("user", "local").all()
    serializer_class = PointBalanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def accumulate(self, request):
        local_id = request.data.get("local")
        amount = request.data.get("amount")

        if not local_id or amount is None:
            return Response({"detail": "local y amount son obligatorios."}, status=400)

        try:
            amount = float(amount)
        except (TypeError, ValueError):
            return Response({"detail": "amount debe ser numérico."}, status=400)

        try:
            local = Local.objects.get(id=local_id)
        except Local.DoesNotExist:
            return Response({"detail": "Local no encontrado."}, status=404)

        points_earned = int(amount * local.points_rate)
        record, _ = PointBalance.objects.get_or_create(user=request.user, local=local)
        record.total += max(points_earned, 0)
        record.save(update_fields=["total", "updated_at"])

        return Response({"earned": points_earned, "total_points": record.total})


class RedemptionViewSet(viewsets.ModelViewSet):
    queryset = Redemption.objects.select_related("user", "local", "reward").all()
    serializer_class = RedemptionSerializer
    permission_classes = [permissions.IsAuthenticated]

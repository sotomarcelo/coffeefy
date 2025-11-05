from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    User,
    Local,
    Product,
    Order,
    OrderItem,
    Reward,
    PointBalance,
    Redemption,
)
from .serializers import (
    UserSerializer,
    LocalSerializer,
    ProductSerializer,
    OrderSerializer,
    OrderItemReadSerializer,
    RewardSerializer,
    PointBalanceSerializer,
    RedemptionSerializer,
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
    queryset = Product.objects.select_related("local").all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


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

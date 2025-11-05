from datetime import timedelta

from django.db import transaction
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import (
    User,
    Local,
    Tag,
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
    TagSerializer,
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
    queryset = Local.objects.select_related("owner").prefetch_related("tags").all()
    serializer_class = LocalSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset().order_by("name")
        scope = self.request.query_params.get("scope")
        if scope:
            queryset = queryset.filter(scope__in=[scope, Tag.Scopes.GENERAL])
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset


class ProductViewSet(viewsets.ModelViewSet):
    queryset = (
        Product.objects.select_related("local", "category").prefetch_related("tags")
    )
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

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        local_id = params.get("local")
        if local_id:
            queryset = queryset.filter(local_id=local_id)

        status_filter = params.get("status")
        if status_filter:
            valid_status = {choice[0] for choice in Order.Status.choices}
            requested = [value.strip() for value in status_filter.split(",") if value.strip()]
            requested = [value for value in requested if value in valid_status]
            if requested:
                queryset = queryset.filter(status__in=requested)

        since_minutes = params.get("since")
        if since_minutes:
            try:
                minutes_value = int(since_minutes)
            except (TypeError, ValueError):
                minutes_value = None
            if minutes_value and minutes_value > 0:
                threshold = timezone.now() - timedelta(minutes=minutes_value)
                queryset = queryset.filter(created_at__gte=threshold)

        search_term = params.get("search")
        if search_term:
            queryset = queryset.filter(
                Q(user__username__icontains=search_term)
                | Q(pickup_code__icontains=search_term)
            )

        ordering = params.get("ordering")
        if ordering:
            queryset = queryset.order_by(*[value.strip() for value in ordering.split(",") if value.strip()])
        else:
            queryset = queryset.order_by("-created_at")

        return queryset

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
        serializer = self.get_serializer(order)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def summary(self, request):
        queryset = self.get_queryset()
        counts = {status: 0 for status, _ in Order.Status.choices}
        for row in queryset.values("status").annotate(total=Count("id")):
            counts[row["status"]] = row["total"]

        active_states = {
            Order.Status.PENDING,
            Order.Status.PREPARING,
            Order.Status.READY,
        }
        now = timezone.now()

        pending_order = queryset.filter(status=Order.Status.PENDING).order_by("created_at").first()
        oldest_pending_minutes = None
        if pending_order:
            oldest_pending_minutes = max(
                (now - pending_order.created_at).total_seconds() / 60.0,
                0.0,
            )

        prep_queryset = queryset.filter(status__in=[Order.Status.PREPARING, Order.Status.READY])
        prep_duration = prep_queryset.annotate(
            duration=ExpressionWrapper(
                F("updated_at") - F("created_at"), output_field=DurationField()
            )
        ).aggregate(avg=Avg("duration"))
        avg_prep_minutes = None
        if prep_duration["avg"] is not None:
            avg_prep_minutes = prep_duration["avg"].total_seconds() / 60.0

        completion_queryset = queryset.filter(status=Order.Status.COMPLETED)
        completion_duration = completion_queryset.annotate(
            duration=ExpressionWrapper(
                F("updated_at") - F("created_at"), output_field=DurationField()
            )
        ).aggregate(avg=Avg("duration"))
        avg_completion_minutes = None
        if completion_duration["avg"] is not None:
            avg_completion_minutes = completion_duration["avg"].total_seconds() / 60.0

        data = {
            "total": sum(counts.values()),
            "counts": counts,
            "active_total": int(sum(counts[state] for state in active_states)),
            "oldest_pending_minutes": oldest_pending_minutes,
            "average_preparation_minutes": avg_prep_minutes,
            "average_completion_minutes": avg_completion_minutes,
            "generated_at": now,
        }

        return Response(data)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated], url_path="active")
    def active_orders(self, request):
        queryset = self.get_queryset().filter(
            status__in=[
                Order.Status.PENDING,
                Order.Status.PREPARING,
                Order.Status.READY,
            ]
        ).order_by("created_at")
        limit = request.query_params.get("limit")
        if limit:
            try:
                limit_value = int(limit)
            except (TypeError, ValueError):
                limit_value = None
            if limit_value and limit_value > 0:
                queryset = queryset[:limit_value]

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class OrderItemViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = OrderItem.objects.select_related("order", "product").all()
    serializer_class = OrderItemReadSerializer
    permission_classes = [permissions.IsAuthenticated]


class RewardViewSet(viewsets.ModelViewSet):
    queryset = Reward.objects.select_related("local").all()
    serializer_class = RewardSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Reward.objects.select_related("local").annotate(
            redemption_count=Count("redemptions")
        )
        params = self.request.query_params
        user = self.request.user

        if not (user.is_superuser or getattr(user, "role", None) == User.Roles.ADMIN):
            local_ids = Local.objects.filter(owner=user).values_list("id", flat=True)
            queryset = queryset.filter(local_id__in=local_ids)

        local_id = params.get("local")
        if local_id:
            queryset = queryset.filter(local_id=local_id)

        active_param = params.get("active")
        if active_param:
            if active_param.lower() == "true":
                queryset = queryset.filter(active=True)
            elif active_param.lower() == "false":
                queryset = queryset.filter(active=False)

        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )

        ordering = params.get("ordering")
        if ordering:
            fields = [value.strip() for value in ordering.split(",") if value.strip()]
            if fields:
                queryset = queryset.order_by(*fields)
        else:
            queryset = queryset.order_by("points_required", "name")

        return queryset

    def _ensure_local_permission(self, local_id):
        user = self.request.user
        if user.is_superuser or getattr(user, "role", None) == User.Roles.ADMIN:
            return
        if not Local.objects.filter(id=local_id, owner=user).exists():
            raise PermissionDenied("No tienes acceso a este local.")

    def perform_create(self, serializer):
        local = serializer.validated_data.get("local")
        if local is not None:
            self._ensure_local_permission(local.id)
        serializer.save()

    def perform_update(self, serializer):
        local = serializer.validated_data.get("local") or serializer.instance.local
        if local is not None:
            self._ensure_local_permission(local.id)
        serializer.save()

    def perform_destroy(self, instance):
        self._ensure_local_permission(instance.local_id)
        instance.delete()

    @action(detail=True, methods=["post"], url_path="toggle", permission_classes=[permissions.IsAuthenticated])
    def toggle_active(self, request, pk=None):
        reward = self.get_object()
        self._ensure_local_permission(reward.local_id)
        reward.active = not reward.active
        reward.save(update_fields=["active", "updated_at"])
        serializer = self.get_serializer(reward)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="available", permission_classes=[permissions.IsAuthenticated])
    def available(self, request):
        params = request.query_params
        queryset = (
            Reward.objects.select_related("local")
            .annotate(redemption_count=Count("redemptions"))
            .filter(active=True)
        )

        local_id = params.get("local")
        if local_id:
            queryset = queryset.filter(local_id=local_id)

        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )

        ordering = params.get("ordering")
        if ordering:
            fields = [value.strip() for value in ordering.split(",") if value.strip()]
            if fields:
                queryset = queryset.order_by(*fields)
        else:
            queryset = queryset.order_by("points_required", "name")

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class PointBalanceViewSet(viewsets.ModelViewSet):
    queryset = PointBalance.objects.select_related("user", "local").all()
    serializer_class = PointBalanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return PointBalance.objects.none()

        queryset = PointBalance.objects.select_related("user", "local")

        if not (user.is_superuser or getattr(user, "role", None) == User.Roles.ADMIN):
            local_ids = Local.objects.filter(owner=user).values_list("id", flat=True)
            queryset = queryset.filter(Q(user=user) | Q(local_id__in=local_ids))

        params = self.request.query_params
        local_id = params.get("local")
        if local_id:
            queryset = queryset.filter(local_id=local_id)

        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(user__username__icontains=search)
                | Q(local__name__icontains=search)
            )

        min_points = params.get("min_points")
        if min_points is not None:
            try:
                queryset = queryset.filter(total__gte=int(min_points))
            except (TypeError, ValueError):
                pass

        max_points = params.get("max_points")
        if max_points is not None:
            try:
                queryset = queryset.filter(total__lte=int(max_points))
            except (TypeError, ValueError):
                pass

        ordering = params.get("ordering")
        if ordering:
            fields = [value.strip() for value in ordering.split(",") if value.strip()]
            if fields:
                queryset = queryset.order_by(*fields)
        else:
            queryset = queryset.order_by("-total", "user__username")

        limit_param = params.get("limit")
        if limit_param is not None:
            try:
                limit_value = int(limit_param)
                if limit_value > 0:
                    queryset = queryset[:limit_value]
            except (TypeError, ValueError):
                pass

        return queryset

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def accumulate(self, request):
        local_id = request.data.get("local")
        amount = request.data.get("amount")
        user_id = request.data.get("user")
        username = request.data.get("username")

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

        target_user = request.user
        if user_id or username:
            try:
                if user_id:
                    target_user = User.objects.get(id=user_id)
                else:
                    target_user = User.objects.get(username=username)
            except User.DoesNotExist:
                return Response({"detail": "Usuario no encontrado."}, status=404)
            self._ensure_owner_access(local.id)

        points_earned = int(amount * local.points_rate)
        record, _ = PointBalance.objects.get_or_create(user=target_user, local=local)
        record.total += max(points_earned, 0)
        record.save(update_fields=["total", "updated_at"])

        serializer = self.get_serializer(record)
        return Response({"earned": points_earned, "balance": serializer.data})

    def _ensure_owner_access(self, local_id):
        user = self.request.user
        if user.is_superuser or getattr(user, "role", None) == User.Roles.ADMIN:
            return
        if not Local.objects.filter(id=local_id, owner=user).exists():
            raise PermissionDenied("No tienes acceso a este local.")

    @action(detail=False, methods=["post"], url_path="adjust", permission_classes=[permissions.IsAuthenticated])
    def adjust(self, request):
        local_id = request.data.get("local")
        user_id = request.data.get("user")
        username = request.data.get("username")
        delta = request.data.get("delta")

        if not local_id:
            return Response({"detail": "local es obligatorio."}, status=400)
        if delta is None:
            return Response({"detail": "delta es obligatorio."}, status=400)

        try:
            delta_value = int(delta)
        except (TypeError, ValueError):
            return Response({"detail": "delta debe ser un entero."}, status=400)

        try:
            local = Local.objects.get(id=local_id)
        except Local.DoesNotExist:
            return Response({"detail": "Local no encontrado."}, status=404)

        target_user = None
        if user_id or username:
            try:
                if user_id:
                    target_user = User.objects.get(id=user_id)
                else:
                    target_user = User.objects.get(username=username)
            except User.DoesNotExist:
                return Response({"detail": "Usuario no encontrado."}, status=404)
        else:
            return Response({"detail": "Debes indicar user o username."}, status=400)

        self._ensure_owner_access(local.id)

        record, _ = PointBalance.objects.get_or_create(user=target_user, local=local)
        record.total = max(record.total + delta_value, 0)
        record.save(update_fields=["total", "updated_at"])

        serializer = self.get_serializer(record)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="summary", permission_classes=[permissions.IsAuthenticated])
    def summary(self, request):
        queryset = self.get_queryset()
        user = self.request.user

        total_points = queryset.aggregate(total=Coalesce(Sum("total"), 0))[
            "total"
        ]
        active_customers = queryset.values("user_id").distinct().count()

        reward_queryset = Reward.objects.select_related("local")
        redemption_queryset = Redemption.objects.select_related("reward", "local", "user")

        if not (user.is_superuser or getattr(user, "role", None) == User.Roles.ADMIN):
            local_ids = Local.objects.filter(owner=user).values_list("id", flat=True)
            reward_queryset = reward_queryset.filter(local_id__in=local_ids)
            redemption_queryset = redemption_queryset.filter(local_id__in=local_ids)

        params = request.query_params
        local_id = params.get("local")
        if local_id:
            reward_queryset = reward_queryset.filter(local_id=local_id)
            redemption_queryset = redemption_queryset.filter(local_id=local_id)

        since_days_param = params.get("since_days")
        try:
            since_days = int(since_days_param)
        except (TypeError, ValueError):
            since_days = 30
        if since_days <= 0:
            since_days = 30

        window_start = timezone.now() - timedelta(days=since_days)
        window_redemptions = redemption_queryset.filter(created_at__gte=window_start)

        window_stats = window_redemptions.aggregate(
            total=Count("id"), points=Coalesce(Sum("points_used"), 0)
        )

        top_customers_queryset = queryset.select_related("user", "local").order_by(
            "-total", "user__username"
        )[:5]
        top_customers = [
            {
                "user_id": balance.user_id,
                "user_name": balance.user.username,
                "local_id": balance.local_id,
                "local_name": balance.local.name,
                "total_points": balance.total,
            }
            for balance in top_customers_queryset
        ]

        top_rewards_rows = (
            window_redemptions.exclude(reward_id__isnull=True)
            .values("reward_id", "reward__name")
            .annotate(redemptions=Count("id"))
            .order_by("-redemptions", "reward__name")[:5]
        )
        top_rewards = [
            {
                "reward_id": row["reward_id"],
                "reward_name": row["reward__name"],
                "redemptions": row["redemptions"],
            }
            for row in top_rewards_rows
        ]

        data = {
            "total_points": total_points,
            "active_customers": active_customers,
            "active_rewards": reward_queryset.filter(active=True).count(),
            "total_rewards": reward_queryset.count(),
            "redemptions_last_window": window_stats["total"],
            "points_redeemed_last_window": window_stats["points"],
            "top_customers": top_customers,
            "top_rewards": top_rewards,
            "generated_at": timezone.now(),
            "window_days": since_days,
        }

        return Response(data)


class RedemptionViewSet(viewsets.ModelViewSet):
    queryset = Redemption.objects.select_related("user", "local", "reward").all()
    serializer_class = RedemptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Redemption.objects.none()

        queryset = Redemption.objects.select_related("user", "local", "reward")

        if not (user.is_superuser or getattr(user, "role", None) == User.Roles.ADMIN):
            local_ids = Local.objects.filter(owner=user).values_list("id", flat=True)
            queryset = queryset.filter(Q(user=user) | Q(local_id__in=local_ids))

        params = self.request.query_params
        local_id = params.get("local")
        if local_id:
            queryset = queryset.filter(local_id=local_id)

        reward_id = params.get("reward")
        if reward_id:
            queryset = queryset.filter(reward_id=reward_id)

        since_days_param = params.get("since_days")
        if since_days_param:
            try:
                since_days = int(since_days_param)
                if since_days > 0:
                    threshold = timezone.now() - timedelta(days=since_days)
                    queryset = queryset.filter(created_at__gte=threshold)
            except (TypeError, ValueError):
                pass

        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(user__username__icontains=search)
                | Q(description__icontains=search)
                | Q(reward__name__icontains=search)
            )

        ordering = params.get("ordering")
        if ordering:
            fields = [value.strip() for value in ordering.split(",") if value.strip()]
            if fields:
                queryset = queryset.order_by(*fields)
        else:
            queryset = queryset.order_by("-created_at")

        limit_param = params.get("limit")
        if limit_param is not None:
            try:
                limit_value = int(limit_param)
                if limit_value > 0:
                    queryset = queryset[:limit_value]
            except (TypeError, ValueError):
                pass

        return queryset

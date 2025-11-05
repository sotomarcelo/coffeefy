from rest_framework.routers import DefaultRouter

from .views import (
	UserViewSet,
	LocalViewSet,
	TagViewSet,
	ProductViewSet,
	ProductCategoryViewSet,
	NotificationViewSet,
	OrderViewSet,
	OrderItemViewSet,
	RewardViewSet,
	PointBalanceViewSet,
	RedemptionViewSet,
)

router = DefaultRouter()
router.register(r"users", UserViewSet)
router.register(r"locals", LocalViewSet)
router.register(r"tags", TagViewSet)
router.register(r"products", ProductViewSet)
router.register(r"categories", ProductCategoryViewSet)
router.register(r"notifications", NotificationViewSet, basename="notifications")
router.register(r"orders", OrderViewSet)
router.register(r"order-items", OrderItemViewSet, basename="order-items")
router.register(r"rewards", RewardViewSet)
router.register(r"points", PointBalanceViewSet)
router.register(r"redemptions", RedemptionViewSet)

urlpatterns = router.urls

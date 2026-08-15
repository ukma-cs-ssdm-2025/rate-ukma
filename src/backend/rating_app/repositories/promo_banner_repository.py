from rating_app.application_schemas.promo_banner import PromoBanner as PromoBannerDTO
from rating_app.models import PromoBanner
from rating_app.repositories.to_domain_mappers import PromoBannerMapper


class PromoBannerRepository:
    """Read-only access to promo banners. Rows are configured in Django admin."""

    def __init__(self, mapper: PromoBannerMapper) -> None:
        self._mapper = mapper

    def get_active(self) -> PromoBannerDTO | None:
        # Meta.ordering set to "-updated_at"
        model = PromoBanner.objects.filter(is_active=True).first()
        if model is None:
            return None
        return self._mapper.process(model)

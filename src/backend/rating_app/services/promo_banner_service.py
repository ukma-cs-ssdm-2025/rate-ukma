from rating_app.application_schemas.promo_banner import PromoBanner
from rating_app.repositories.promo_banner_repository import PromoBannerRepository


class PromoBannerService:
    def __init__(self, promo_banner_repository: PromoBannerRepository):
        self.promo_banner_repository = promo_banner_repository

    def get_active_banner(self) -> PromoBanner | None:
        return self.promo_banner_repository.get_active()

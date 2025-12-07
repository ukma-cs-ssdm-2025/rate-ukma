from django.apps import AppConfig


class RatingAppConfig(AppConfig):
    name = "rating_app"

    def ready(self):
        from rating_app.ioc_container.services import register_observers

        register_observers()

from django.core.management.base import BaseCommand

from rating_app.ioc_container.services import feed_update_service


class Command(BaseCommand):
    help = (
        "Re-derive the feed index (FeedEvent) from its source tables. "
        "Use after writes that bypass the application layer: bulk loads, mock data, raw SQL."
    )

    def handle(self, *args, **options):
        count = feed_update_service().rebuild()
        self.stdout.write(self.style.SUCCESS(f"Feed index rebuilt: {count} entries."))

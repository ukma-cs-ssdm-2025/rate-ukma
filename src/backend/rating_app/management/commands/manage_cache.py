from django.core.management.base import BaseCommand

from rateukma.caching.instances import redis_cache_manager


class Command(BaseCommand):
    help = "Display rating_app Redis cache statistics and information, or clear the cache"

    def add_arguments(self, parser):
        parser.add_argument(
            "--keys",
            type=int,
            nargs="?",
            const=10,
            default=0,
            help="Number of sample cache keys to show (default: 10 if flag used, 0 if not)",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear all cache keys",
        )

    def handle(self, *args, **options):
        keys_count = options.get("keys", 0)
        should_clear = options.get("clear", False)

        cache_manager = redis_cache_manager()

        if should_clear:
            self.stdout.write("Clearing all cache keys...")
            cleared_count = cache_manager.invalidate_pattern("*")
            self.stdout.write(
                self.style.SUCCESS(f"Successfully cleared {cleared_count} cache keys")  # type: ignore
            )
            return

        stats = cache_manager.get_stats()

        if not stats:
            self.stderr.write("Failed to retrieve cache statistics")
            return

        self.stdout.write("Redis Cache Statistics")
        self.stdout.write("=" * 50)

        self.stdout.write(f"Total Keys: {stats.get('total_keys', 'N/A')}")
        self.stdout.write(f"Memory Used: {stats.get('used_memory', 'N/A')}")
        self.stdout.write(f"Connected Clients: {stats.get('connected_clients', 'N/A')}")
        self.stdout.write(f"Cache Hits: {stats.get('hits', 'N/A')}")
        self.stdout.write(f"Cache Misses: {stats.get('misses', 'N/A')}")

        hit_rate = stats.get("hit_rate")
        if hit_rate is not None:
            self.stdout.write(f"Hit Rate: {hit_rate:.2f}%")
        else:
            self.stdout.write("Hit Rate: N/A")

        if keys_count > 0:
            self.stdout.write(f"\nSample Cache Keys (up to {keys_count}):")
            self._show_sample_keys(cache_manager, keys_count)

    def _show_sample_keys(self, cache_manager, keys_count: int):
        try:
            redis_client = cache_manager.redis_client
            prefix = cache_manager.key_prefix + ":"
            cursor = 0
            keys_found = []

            while len(keys_found) < keys_count:
                cursor, keys = redis_client.scan(cursor, match=f"{prefix}*", count=10)
                for key in keys:
                    if isinstance(key, bytes):
                        key = key.decode("utf-8")
                    display_key = key[len(prefix) :] if key.startswith(prefix) else key
                    keys_found.append(display_key)

                    if len(keys_found) >= keys_count:
                        break

                if cursor == 0:
                    break

            if keys_found:
                for key in keys_found[:keys_count]:
                    self.stdout.write(f"  {key}")
            else:
                self.stdout.write("  No cache keys found")

        except Exception as e:
            self.stderr.write(f"Error retrieving sample keys: {e}")

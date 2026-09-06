from django.conf import settings
from rest_framework import serializers


class PublicFeatureFlagsSerializer(serializers.Serializer):
    def get_fields(self):
        """Build one BooleanField per allowlisted flag.

        Read at call time, not import, so settings overrides in tests are honoured.
        """
        return {
            name: serializers.BooleanField(
                help_text=f"Whether `{name}` is enabled for the current user."
            )
            for name in settings.PUBLIC_FEATURE_FLAGS
        }


class FeatureFlagsSerializer(serializers.Serializer):
    flags = PublicFeatureFlagsSerializer(
        help_text="Enabled state of each public feature flag for the current user.",
    )

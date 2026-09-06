from django.conf import settings
from rest_framework import serializers


class PublicFeatureFlagsSerializer(serializers.Serializer):
    # Built per call, not at import, so settings overrides in tests are honoured.
    def get_fields(self):
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

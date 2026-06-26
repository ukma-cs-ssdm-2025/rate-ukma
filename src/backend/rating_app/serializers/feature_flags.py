from rest_framework import serializers


class FeatureFlagsSerializer(serializers.Serializer):
    flags = serializers.DictField(
        child=serializers.BooleanField(),
        read_only=True,
        help_text="Map of public feature flag name to its enabled state for the current user.",
    )

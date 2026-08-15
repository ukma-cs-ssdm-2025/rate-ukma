from rest_framework import serializers


class PromoBannerSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(read_only=True)
    description = serializers.CharField(read_only=True, allow_blank=True)
    href = serializers.CharField(read_only=True)
    cta_label = serializers.CharField(read_only=True)
    logo_url = serializers.CharField(read_only=True, allow_null=True)
    logo_alt = serializers.CharField(read_only=True, allow_blank=True)


class PromoBannerResponseSerializer(serializers.Serializer):
    banner = PromoBannerSerializer(
        read_only=True,
        allow_null=True,
        help_text="The active promo banner, or null when none is configured.",
    )

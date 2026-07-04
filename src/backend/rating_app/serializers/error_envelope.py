from rest_framework import serializers
from rest_framework.fields import DictField


class ErrorEnvelopeSerializer(serializers.Serializer):
    detail = serializers.CharField()
    status = serializers.IntegerField()
    # name clashes with Serializer.fields; DRF's metaclass keeps this safe at runtime
    fields: DictField = serializers.DictField(  # pyright: ignore[reportIncompatibleVariableOverride]
        child=serializers.ListField(child=serializers.CharField()), required=False
    )

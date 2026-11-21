from rest_framework import serializers
from rest_framework.fields import DictField


class ErrorEnvelopeSerializer(serializers.Serializer):
    detail = serializers.CharField()
    status = serializers.IntegerField()
    fields: DictField = serializers.DictField(  # pyright: ignore[reportIncompatibleVariableOverride]  # clashes with Serializer.fields, safe at runtime
        child=serializers.ListField(child=serializers.CharField()), required=False
    )

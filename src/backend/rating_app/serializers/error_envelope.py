from rest_framework import serializers
from rest_framework.fields import CharField, DictField, IntegerField


class ErrorEnvelopeSerializer(serializers.Serializer):
    detail: CharField = serializers.CharField()
    status: IntegerField = serializers.IntegerField()
    fields: DictField = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField()), required=False
    )

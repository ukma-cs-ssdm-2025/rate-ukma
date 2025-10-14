from rest_framework import serializers


class ErrorEnvelopeSerializer(serializers.Serializer):
    detail = serializers.CharField()
    status = serializers.IntegerField()
    fields = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField()), required=False
    )

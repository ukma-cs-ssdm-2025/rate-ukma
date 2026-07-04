from rest_framework import serializers
from rest_framework.fields import DictField


class ErrorEnvelopeSerializer(serializers.Serializer):
    detail = serializers.CharField()
    status = serializers.IntegerField()
    # Clashes with Serializer.fields (BindingDict property); DRF's metaclass moves
    # declared fields out of the class dict at runtime, so the override is safe.
    fields: DictField = serializers.DictField(  # pyright: ignore[reportIncompatibleVariableOverride, reportAssignmentType]
        child=serializers.ListField(child=serializers.CharField()), required=False
    )

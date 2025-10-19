from typing import TypedDict

from rest_framework import serializers


class LoginDto(TypedDict):
    username: str
    password: str


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128, write_only=True)


class SessionUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()


class SessionSerializer(serializers.Serializer):
    is_authenticated = serializers.BooleanField()
    user = SessionUserSerializer(allow_null=True)
    expires_at = serializers.DateTimeField(allow_null=True, required=False)

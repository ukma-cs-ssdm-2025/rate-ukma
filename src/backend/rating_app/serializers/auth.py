from typing import TypedDict

from rest_framework import serializers


class LoginDto(TypedDict):
    username: str
    password: str


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128, write_only=True)

from rest_framework import serializers

from rating_app.models import Instructor


class InstructorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Instructor
        fields = [
            "id",
            "first_name",
            "patronymic",
            "last_name",
        ]
        read_only_fields = ["id"]

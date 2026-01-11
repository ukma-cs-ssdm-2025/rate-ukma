from rest_framework import serializers

from rating_app.models.choices import RatingVoteType

from ..models import RatingVote


class RatingVoteReadSerializer(serializers.ModelSerializer):
    vote_type = serializers.ChoiceField(
        choices=RatingVoteType.choices, source="type", read_only=True
    )

    class Meta:
        model = RatingVote
        fields = ["id", "student", "rating", "vote_type"]
        read_only_fields = ["id", "student", "rating", "vote_type"]

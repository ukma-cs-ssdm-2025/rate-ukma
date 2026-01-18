from rest_framework import serializers

from rating_app.repositories.to_domain_mappers import RatingVoteMapper

from ..models import RatingVote


class RatingVoteReadSerializer(serializers.ModelSerializer):
    vote_type = serializers.SerializerMethodField()

    class Meta:
        model = RatingVote
        fields = ["id", "student", "rating", "vote_type"]
        read_only_fields = ["id", "student", "rating", "vote_type"]

    def get_vote_type(self, obj: RatingVote) -> str | None:
        return RatingVoteMapper.to_domain(obj.type)

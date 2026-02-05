from rest_framework import serializers

from rating_app.application_schemas.rating_vote import RatingVote as RatingVoteDTO
from rating_app.repositories.to_domain_mappers import RatingVoteMapper


class RatingVoteReadSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    student = serializers.UUIDField(source="student_id", read_only=True)
    rating = serializers.UUIDField(source="rating_id", read_only=True)
    vote_type = serializers.SerializerMethodField()

    def get_vote_type(self, obj: RatingVoteDTO) -> str | None:
        return RatingVoteMapper.to_domain(obj.vote_type)

import uuid

from django.db import models

from .choices import RatingVoteType
from .rating import Rating
from .student import Student


class RatingVote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="rating_vote")
    rating = models.ForeignKey(Rating, on_delete=models.CASCADE, related_name="rating_vote")
    type = models.CharField(
        max_length=10,
        choices=RatingVoteType.choices,
    )

    class Meta:
        unique_together = ("student", "rating")
        verbose_name = "Rating Vote"
        verbose_name_plural = "Rating Votes"

    def __str__(self):
        return (
            f"{self.student.last_name} {self.student.first_name} - {self.rating.id} : {self.type}"
        )

    def __repr__(self):
        return (
            f"<Vote id={self.id} user_id={self.student.id} "
            f"rating_id={self.rating.id} vote_type={self.type}>"
        )

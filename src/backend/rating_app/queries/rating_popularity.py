from dataclasses import dataclass

from django.db.models import Case, ExpressionWrapper, F, FloatField, Q, QuerySet, Value, When
from django.db.models.functions import Cast, NullIf, Sqrt

from rating_app.models import Rating


@dataclass(frozen=True)
class WilsonPopularityAnnotator:
    z: float = 1.96  # 95%

    def apply(self, queryset: QuerySet[Rating]) -> QuerySet[Rating]:
        """
        Annotate ratings with a `popularity_score` computed using the Wilson score
        interval (lower bound). Requires upvotes_count/downvotes_count annotated

        The Wilson score is used to rank ratings by *reliable helpfulness* based on
        upvotes and downvotes. Instead of using the raw upvote ratio, it computes a
        conservative lower bound of the true approval probability, penalizing
        ratings with few votes and reducing the impact of early or noisy feedback.

        This makes the ordering stable and resistant to manipulation (e.g. a rating
        with 1 upvote will not outrank a rating with many consistent votes).

        Details:
        - Each rating is treated as a Bernoulli process (upvote = success,
        downvote = failure).
        - The Wilson lower bound is computed with a z-score of 1.96 (95% confidence).
        - The resulting score is in the range [0.0, 1.0].
        - Ratings with no votes (upvotes + downvotes == 0) are assigned a score of 0.0

        Formula (lower bound):
            (p + z²/(2n) - z * sqrt(p(1-p)/n + z²/(4n²))) / (1 + z²/n)

        Where:
            p = upvotes / (upvotes + downvotes)
            n = upvotes + downvotes
            z = 1.96
        """
        up = Cast(F("upvotes_count"), FloatField())
        down = Cast(F("downvotes_count"), FloatField())

        n = ExpressionWrapper(up + down, output_field=FloatField())
        n0 = NullIf(n, 0.0)  # NULL when n == 0

        p = ExpressionWrapper(up / n0, output_field=FloatField())

        z2 = self.z * self.z

        sqrt_term = Sqrt(
            ExpressionWrapper(
                (p * (1.0 - p) / n0) + (z2 / (4.0 * n0 * n0)),
                output_field=FloatField(),
            )
        )

        numerator = ExpressionWrapper(
            p + (z2 / (2.0 * n0)) - (self.z * sqrt_term),
            output_field=FloatField(),
        )
        denominator = ExpressionWrapper(1.0 + (z2 / n0), output_field=FloatField())
        wilson_lower_bound = ExpressionWrapper(numerator / denominator, output_field=FloatField())

        return queryset.annotate(
            popularity_score=Case(
                When(Q(upvotes_count__gt=0) | Q(downvotes_count__gt=0), then=wilson_lower_bound),
                default=Value(0.0),
                output_field=FloatField(),
            )
        )

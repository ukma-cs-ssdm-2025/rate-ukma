from typing import Any

from django.core.paginator import EmptyPage, Paginator

from rating_app.models import Rating

from ..constants import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    MIN_PAGE_SIZE,
)


class RatingRepository:
    def get_by_id(self, rating_id: str) -> Rating:
        return Rating.objects.select_related(
            "course_offering__course",
            "course_offering__semester",
            "student",
        ).get(pk=rating_id)

    def filter(
        self,
        course_id: str | None = None,
        student_id: str | None = None,
        page_size: int = DEFAULT_PAGE_SIZE,
        page_number: int = MIN_PAGE_SIZE,
    ) -> dict[str, Any]:
        """
        Returns a paginated result:
            {
              "items": [Rating, ...],
              "page": 1,
              "page_size": 10,
              "total": 50,
              "total_pages": 5,
            }
        """
        filters: dict[str, Any] = {}
        if course_id:
            filters["course_offering__course_id"] = course_id
        if student_id:
            filters["student_id"] = student_id

        ratings = (
            Rating.objects.select_related(
                "course_offering__course",
                "course_offering__semester",
                "student",
            )
            .filter(**filters)
            .order_by("-created_at")
        )

        # Guardrails
        page_size = max(MIN_PAGE_SIZE, min(int(page_size or DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE))
        page_number = max(MIN_PAGE_SIZE, int(page_number or MIN_PAGE_SIZE))

        paginator = Paginator(ratings, page_size)

        try:
            page_obj = paginator.page(page_number)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages)

        items = list(page_obj.object_list)
        return {
            "items": items,
            "page": page_obj.number,
            "page_size": page_obj.paginator.per_page,
            "total": paginator.count,
            "total_pages": paginator.num_pages,
        }

    def create(self, **rating_data) -> Rating:
        return Rating.objects.create(**rating_data)

    def update(self, rating: Rating, **update_data) -> Rating:
        for attr, value in update_data.items():
            setattr(rating, attr, value)
        rating.save()
        return rating

    def delete(self, rating: Rating) -> None:
        rating.delete()

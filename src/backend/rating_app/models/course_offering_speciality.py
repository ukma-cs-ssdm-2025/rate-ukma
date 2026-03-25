import uuid

from django.db import models

from .choices import CourseTypeKind


class CourseOfferingSpeciality(models.Model):
    """
    Through-model linking a CourseOffering to the Speciality it was offered to,
    with the type_kind (COMPULSORY/ELECTIVE/PROF_ORIENTED) for that pairing.

    This is the source of truth for offering↔speciality data.
    Course-level specialities (CourseSpeciality) are a denormalised union of these
    rows and will be removed once all queries are migrated.
    # TODO(#511): remove CourseSpeciality after this table is fully populated in prod.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    offering = models.ForeignKey(
        "CourseOffering",
        on_delete=models.CASCADE,
        related_name="course_offering_specialities",
    )
    speciality = models.ForeignKey(
        "Speciality",
        on_delete=models.CASCADE,
        related_name="course_offering_specialities",
    )
    type_kind = models.CharField(
        max_length=16,
        choices=CourseTypeKind.choices,
    )

    class Meta:
        unique_together = ("offering", "speciality")
        indexes = [
            models.Index(fields=["speciality", "type_kind"], name="cos_spec_type_idx"),
        ]
        verbose_name = "Course offering speciality"
        verbose_name_plural = "Course offering specialities"

    def __str__(self):
        return f"{self.offering} – {self.speciality} ({self.type_kind})"

    def __repr__(self):
        return (
            f"<CourseOfferingSpeciality offering={self.offering_id} "
            f"speciality={self.speciality_id} type_kind={self.type_kind}>"
        )

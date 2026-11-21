import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class ListStatus(models.TextChoices):
    BUILDING = "building", "Building"
    READY = "ready", "Ready"
    SUPERSEDED = "superseded", "Superseded"
    FAILED = "failed", "Failed"


class ProposalGroup(models.TextChoices):
    LINK = "link", "Link"
    NEW = "new", "New"
    CHANGE = "change", "Change"
    MAPPING = "mapping", "Mapping"
    REMOVED = "removed", "Removed"


class ProposalKind(models.TextChoices):
    LINK_FACULTY = "link_faculty", "Link faculty"
    LINK_DEPARTMENT = "link_department", "Link department"
    LINK_COURSE = "link_course", "Link course"
    LINK_OFFERING = "link_offering", "Link offering"
    NEW_FACULTY = "new_faculty", "New faculty"
    NEW_DEPARTMENT = "new_department", "New department"
    NEW_COURSE = "new_course", "New course"
    NEW_OFFERING = "new_offering", "New offering"
    CHANGE_FACULTY = "change_faculty", "Change faculty"
    CHANGE_DEPARTMENT = "change_department", "Change department"
    CHANGE_COURSE = "change_course", "Change course"
    CHANGE_OFFERING = "change_offering", "Change offering"
    MERGE_COURSES = "merge_courses", "Merge courses"
    MOVE_OFFERING = "move_offering", "Move offering"
    PLACE_OFFERING = "place_offering", "Place offering"
    RELINK_COURSE = "relink_course", "Relink course"
    REMOVED_OFFERING = "removed_offering", "Removed offering"


class ProposalStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPLIED = "applied", "Applied"
    STALE = "stale", "Stale"
    DISMISSED = "dismissed", "Dismissed"


class MappingAnswer(models.TextChoices):
    KEEP_APART = "keep_apart", "Keep apart"
    MERGE = "merge", "Merge"
    KEEP = "keep", "Keep"
    MOVE = "move", "Move"
    PLACE = "place", "Place"
    RELINK = "relink", "Relink"


class ApprovalOutcome(models.TextChoices):
    STARTED = "started", "Started"
    APPLIED = "applied", "Applied"
    REFUSED = "refused", "Refused"
    FAILED = "failed", "Failed"


KIND_GROUP: dict[str, str] = {
    "link_faculty": "link",
    "link_department": "link",
    "link_course": "link",
    "link_offering": "link",
    "new_faculty": "new",
    "new_department": "new",
    "new_course": "new",
    "new_offering": "new",
    "change_faculty": "change",
    "change_department": "change",
    "change_course": "change",
    "change_offering": "change",
    "merge_courses": "mapping",
    "move_offering": "mapping",
    "place_offering": "mapping",
    "relink_course": "mapping",
    "removed_offering": "removed",
}


class CatalogProposalList(models.Model):
    """One nightly comparison of UKMA Data with Rate UKMA's catalog."""

    id: int

    status = models.CharField(
        max_length=16, choices=ListStatus.choices, default=ListStatus.BUILDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    head_cursors = models.JSONField(default=dict)
    data_updated_at = models.DateTimeField(null=True, blank=True)
    summary = models.JSONField(default=dict)
    error = models.TextField(blank=True, default="")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["status"],
                condition=Q(status=ListStatus.READY),
                name="catalog_list_one_ready",
            ),
        ]

    def __str__(self) -> str:
        return f"Catalog proposal list {self.id} ({self.status})"


class CatalogProposal(models.Model):
    id: int
    list_id: int

    list = models.ForeignKey(
        CatalogProposalList, on_delete=models.CASCADE, related_name="proposals"
    )
    group = models.CharField(max_length=16, choices=ProposalGroup.choices)
    kind = models.CharField(max_length=32, choices=ProposalKind.choices)
    ukma_data_id = models.CharField(max_length=64, null=True, blank=True)
    target_id = models.CharField(max_length=64, null=True, blank=True)
    before = models.JSONField(default=dict)
    after = models.JSONField(default=dict)
    ratings = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=16, choices=ProposalStatus.choices, default=ProposalStatus.PENDING
    )
    applied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["list", "group", "status"], name="catalog_prop_group_status_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["list", "kind", "ukma_data_id", "target_id"],
                name="catalog_proposal_unique",
                nulls_distinct=False,
            ),
        ]

    def __str__(self) -> str:
        return f"Catalog proposal {self.id} ({self.kind})"


class CatalogMappingDecision(models.Model):
    id: int
    course_id: uuid.UUID | None
    offering_id: uuid.UUID | None
    into_id: uuid.UUID | None
    decided_by_id: int

    kind = models.CharField(max_length=32, choices=ProposalKind.choices)
    ukma_course_id = models.CharField(max_length=64)
    course = models.ForeignKey(
        "rating_app.Course",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="catalog_decisions",
    )
    offering = models.ForeignKey(
        "rating_app.CourseOffering",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="catalog_decisions",
    )
    answer = models.CharField(max_length=16, choices=MappingAnswer.choices)
    into = models.ForeignKey(
        "rating_app.Course",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="catalog_decisions_into",
    )
    premise = models.JSONField(default=dict)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="catalog_decisions"
    )
    decided_at = models.DateTimeField(auto_now_add=True)
    applied_at = models.DateTimeField(null=True, blank=True)
    superseded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["kind", "ukma_course_id", "course", "offering"],
                condition=Q(superseded_at__isnull=True),
                name="catalog_decision_unique",
                nulls_distinct=False,
            ),
        ]

    def __str__(self) -> str:
        return f"Catalog mapping decision {self.id} ({self.kind}: {self.answer})"


class CatalogApproval(models.Model):
    id: int
    list_id: int | None
    user_id: int | None

    list = models.ForeignKey(
        CatalogProposalList,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approvals",
    )
    list_ref = models.PositiveBigIntegerField()
    group = models.CharField(max_length=16, choices=ProposalGroup.choices)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="catalog_approvals",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    dry_run = models.BooleanField(default=False)
    outcome = models.CharField(max_length=16, choices=ApprovalOutcome.choices)
    counts = models.JSONField(default=dict)
    error = models.TextField(blank=True, default="")

    def __str__(self) -> str:
        return f"Catalog approval {self.id} ({self.group}: {self.outcome})"


class CatalogSyncCursor(models.Model):
    id: int
    list_name = models.CharField(max_length=32, unique=True)
    change_no = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Catalog sync cursor {self.list_name} = {self.change_no}"

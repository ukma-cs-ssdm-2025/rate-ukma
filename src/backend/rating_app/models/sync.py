import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from rating_app.sync.kinds import NEVER_AUTO_KINDS


class SyncSource(models.TextChoices):
    TEACHERS = "teachers", "Teachers"
    CATALOG = "catalog", "Catalog"


class SyncRunStatus(models.TextChoices):
    RUNNING = "running", "Running"
    SUCCEEDED = "succeeded", "Succeeded"
    FAILED = "failed", "Failed"


class SyncChangeGroup(models.TextChoices):
    LINK = "link", "Link"
    NEW = "new", "New"
    CHANGE = "change", "Change"
    MAPPING = "mapping", "Mapping"
    REMOVED = "removed", "Removed"


class SyncChangeState(models.TextChoices):
    PROPOSED = "proposed", "Proposed"
    APPLIED = "applied", "Applied"
    REJECTED = "rejected", "Rejected"
    SUPERSEDED = "superseded", "Superseded"
    REVERTED = "reverted", "Reverted"


class SyncChangeStateReason(models.TextChoices):
    REPLACED = "replaced", "Replaced"
    STALE = "stale", "Stale"
    EXISTS = "exists", "Exists"
    IDENTITY_COLLISION = "identity_collision", "Identity collision"
    DEPENDENCY_REJECTED = "dependency_rejected", "Dependency rejected"


class SyncPolicyMode(models.TextChoices):
    NEEDS_APPROVAL = "needs_approval", "Needs approval"
    AUTO = "auto", "Auto"


class SyncApprovalAction(models.TextChoices):
    APPLY = "apply", "Apply"
    REJECT = "reject", "Reject"
    REVERT = "revert", "Revert"
    PREVIEW = "preview", "Preview"


class SyncApprovalScope(models.TextChoices):
    CHANGE = "change", "Change"
    KIND = "kind", "Kind"
    GROUP = "group", "Group"


class SyncApprovalOutcome(models.TextChoices):
    STARTED = "started", "Started"
    APPLIED = "applied", "Applied"
    REFUSED = "refused", "Refused"
    FAILED = "failed", "Failed"


class MappingAnswer(models.TextChoices):
    KEEP_APART = "keep_apart", "Keep apart"
    MERGE = "merge", "Merge"
    KEEP = "keep", "Keep"
    MOVE = "move", "Move"
    PLACE = "place", "Place"
    RELINK = "relink", "Relink"


class SyncRun(models.Model):
    """One execution of a sync from UKMA Data."""

    id: int

    source = models.CharField(max_length=16, choices=SyncSource.choices)
    status = models.CharField(
        max_length=16, choices=SyncRunStatus.choices, default=SyncRunStatus.RUNNING
    )
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    cursor_from = models.JSONField(default=dict)
    cursor_to = models.JSONField(default=dict)
    cursor_saved = models.JSONField(default=dict)
    data_updated_at = models.DateTimeField(null=True, blank=True)
    counts = models.JSONField(default=dict)
    skipped_rated = models.JSONField(default=dict)
    error = models.TextField(blank=True, default="")

    def __str__(self) -> str:
        return f"Sync run {self.pk} ({self.source}: {self.status})"


class SyncChange(models.Model):
    """One difference a sync run found, and what became of it."""

    id: int
    run_id: int
    approval_id: int | None

    run = models.ForeignKey(SyncRun, on_delete=models.CASCADE, related_name="changes")
    source = models.CharField(max_length=16, choices=SyncSource.choices)
    group = models.CharField(max_length=16, choices=SyncChangeGroup.choices)
    kind = models.CharField(max_length=32)
    key = models.CharField(max_length=512)
    ukma_data_id = models.CharField(max_length=64, null=True, blank=True)
    target_id = models.CharField(max_length=64, null=True, blank=True)
    before = models.JSONField(default=dict)
    after = models.JSONField(default=dict)
    requires = models.JSONField(default=list)
    waiting_on = models.JSONField(default=list)
    ratings = models.PositiveIntegerField(default=0)
    state = models.CharField(
        max_length=16, choices=SyncChangeState.choices, default=SyncChangeState.PROPOSED
    )
    state_reason = models.CharField(
        max_length=32, choices=SyncChangeStateReason.choices, blank=True, default=""
    )
    approval = models.ForeignKey(
        "SyncApproval",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="changes",
    )
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["run", "group", "state"], name="sync_change_run_grp_state_idx"),
            models.Index(fields=["source", "state"], name="sync_change_source_state_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["run", "kind", "key"], name="sync_change_run_kind_key_unique"
            ),
        ]

    def __str__(self) -> str:
        return f"Sync change {self.pk} ({self.kind}: {self.state})"


class SyncPolicy(models.Model):
    """Whether one kind of change applies by itself or waits for a person."""

    id: int
    updated_by_id: int

    kind = models.CharField(max_length=32, unique=True)
    mode = models.CharField(
        max_length=16, choices=SyncPolicyMode.choices, default=SyncPolicyMode.NEEDS_APPROVAL
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="sync_policies"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~Q(mode=SyncPolicyMode.AUTO, kind__in=NEVER_AUTO_KINDS),
                name="sync_policy_never_auto",
            ),
        ]

    def __str__(self) -> str:
        return f"Sync policy {self.kind}: {self.mode}"


class SyncPolicyChange(models.Model):
    """The audit of every policy write; never updated or deleted."""

    id: int
    user_id: int

    kind = models.CharField(max_length=32)
    old_mode = models.CharField(max_length=16, choices=SyncPolicyMode.choices)
    new_mode = models.CharField(max_length=16, choices=SyncPolicyMode.choices)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="sync_policy_changes"
    )
    changed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Sync policy change {self.kind}: {self.old_mode} -> {self.new_mode}"


class SyncApproval(models.Model):
    """One approve, reject or preview, written before any catalog write."""

    id: int
    run_id: int | None
    user_id: int | None
    policy_change_id: int | None
    reverts_id: int | None

    run = models.ForeignKey(
        SyncRun, on_delete=models.SET_NULL, null=True, blank=True, related_name="approvals"
    )
    run_ref = models.PositiveBigIntegerField()
    action = models.CharField(max_length=16, choices=SyncApprovalAction.choices)
    scope = models.CharField(max_length=16, choices=SyncApprovalScope.choices)
    group = models.CharField(max_length=16, choices=SyncChangeGroup.choices, blank=True, default="")
    kind = models.CharField(max_length=32, blank=True, default="")
    change_ids = models.JSONField(default=list)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="sync_approvals",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    outcome = models.CharField(max_length=16, choices=SyncApprovalOutcome.choices)
    counts = models.JSONField(default=dict)
    client_key = models.UUIDField(null=True, blank=True, unique=True)
    error = models.TextField(blank=True, default="")
    policy_change = models.ForeignKey(
        SyncPolicyChange,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="approvals",
    )
    reverts = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reverted_by",
    )

    def __str__(self) -> str:
        return f"Sync approval {self.pk} ({self.action}: {self.outcome})"


class SyncPreview(models.Model):
    """The count behind one preview token, so a changed selection can say what was."""

    id: int
    run_id: int
    user_id: int

    token = models.CharField(max_length=128, unique=True)
    run = models.ForeignKey(SyncRun, on_delete=models.CASCADE, related_name="previews")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sync_previews"
    )
    count = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Sync preview {self.token} ({self.count})"


class CatalogMappingDecision(models.Model):
    """A staff answer to a mapping question, with the premise it was made on."""

    id: int
    course_id: uuid.UUID | None
    offering_id: uuid.UUID | None
    into_id: uuid.UUID | None
    decided_by_id: int

    kind = models.CharField(max_length=32)
    # The SyncChange.key of the question this answers, so two answers about
    # one UKMA Data course (two offerings placed on one course) stay apart.
    question_key = models.CharField(max_length=255)
    ukma_course_id = models.CharField(max_length=64)
    saz_code = models.CharField(max_length=16, blank=True, default="")
    # SET_NULL with the ids copied: a merge must be able to delete the course
    # it emptied, and admin deletes keep working. A decision whose row is gone
    # is ignored by the builder and asked again.
    course = models.ForeignKey(
        "rating_app.Course",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sync_decisions",
    )
    course_ref = models.CharField(max_length=64, blank=True, default="")
    offering = models.ForeignKey(
        "rating_app.CourseOffering",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sync_decisions",
    )
    offering_ref = models.CharField(max_length=64, blank=True, default="")
    answer = models.CharField(max_length=16, choices=MappingAnswer.choices)
    into = models.ForeignKey(
        "rating_app.Course",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sync_decisions_into",
    )
    into_ref = models.CharField(max_length=64, blank=True, default="")
    premise = models.JSONField(default=dict)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="sync_decisions"
    )
    decided_at = models.DateTimeField(auto_now_add=True)
    applied_at = models.DateTimeField(null=True, blank=True)
    superseded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["kind", "question_key"],
                condition=Q(superseded_at__isnull=True),
                name="sync_decision_live_unique",
            ),
        ]

    def __str__(self) -> str:
        return f"Catalog mapping decision {self.pk} ({self.kind}: {self.answer})"


class SyncCursor(models.Model):
    """The highest change number an apply saved for one UKMA Data list."""

    id: int

    source = models.CharField(max_length=16, choices=SyncSource.choices)
    list_name = models.CharField(max_length=64)
    change_no = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["source", "list_name"], name="sync_cursor_source_list_unique"
            ),
        ]

    def __str__(self) -> str:
        return f"Sync cursor {self.source}/{self.list_name} = {self.change_no}"

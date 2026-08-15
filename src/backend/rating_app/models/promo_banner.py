import uuid

from django.core.validators import FileExtensionValidator
from django.db import models, transaction

PROMO_LOGO_EXTENSIONS = ["svg", "png", "webp", "jpg", "jpeg"]


class PromoBanner(models.Model):
    """
    A promo shown at the top of the courses page.

    Many rows may exist, but at most one is active at a time. Editors stage the
    next campaign as an inactive row and flip `is_active` when it goes live;
    activating it stands the previous banner down automatically.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(
        max_length=100,
        help_text="Bold lead-in, e.g. the promoted app's name.",
    )
    description = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Muted continuation shown next to the title. Hidden on small screens.",
    )
    href = models.URLField(
        max_length=500,
        help_text="Where the banner links to. Opens in a new tab.",
    )
    cta_label = models.CharField(
        max_length=40,
        default="Відкрити",
        help_text="Text of the call-to-action link.",
    )
    logo = models.FileField(
        upload_to="promo/",
        blank=True,
        validators=[FileExtensionValidator(PROMO_LOGO_EXTENSIONS)],
        help_text=f"Square logo. Allowed: {', '.join(PROMO_LOGO_EXTENSIONS)}.",
    )
    logo_alt = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Alt text for the logo. Falls back to the title when empty.",
    )
    is_active = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Activating this banner deactivates any other active one.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "Promo Banner"
        verbose_name_plural = "Promo Banners"

    def save(self, *args, **kwargs):
        """Enforce at most one active banner.

        Activating a banner stands the previous one down, so editors can flip
        the new campaign on without remembering to switch the old one off.
        `update()` is deliberate: it skips `save()` (no recursion) and leaves
        `updated_at` alone on rows that were only stood down.
        """
        with transaction.atomic():
            super().save(*args, **kwargs)
            if self.is_active:
                PromoBanner.objects.filter(is_active=True).exclude(pk=self.pk).update(
                    is_active=False
                )

    def __str__(self):
        state = "active" if self.is_active else "inactive"
        return f"{self.title} ({state})"

    def __repr__(self):
        return f"<PromoBanner id={self.id} title={self.title} is_active={self.is_active}>"

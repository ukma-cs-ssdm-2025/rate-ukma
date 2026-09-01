from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from django.db.models import Count, Q

from reversion.admin import VersionAdmin

from rating_app.models import (
    Comment,
    Course,
    CourseInstructor,
    CourseOffering,
    CourseOfferingSpeciality,
    Department,
    Enrollment,
    Faculty,
    Instructor,
    PromoBanner,
    Rating,
    RatingVote,
    Semester,
    Speciality,
    Student,
)
from rating_app.models.choices import RatingVoteType

admin.site.unregister(User)


@admin.register(User)
class CustomUserAdmin(BaseUserAdmin):
    list_display = (
        "email",
        "first_name",
        "last_name",
        "last_login",
        "date_joined",
        "ratings_count",
        "is_active",
    )
    list_filter = (
        "date_joined",
        "last_login",
        "is_active",
        "is_staff",
        "is_superuser",
    )
    search_fields = (
        "first_name",
        "last_name",
        "email",
        "username",
    )
    ordering = ("-date_joined",)

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .annotate(
                _overall_rated_courses=Count(
                    "student_profile__ratings__course_offering__course",
                    distinct=True,
                )
            )
        )

    @admin.display(description="Ratings", ordering="_overall_rated_courses")
    def ratings_count(self, obj):
        return obj._overall_rated_courses


@admin.register(Course)
class CourseAdmin(VersionAdmin):
    list_display = (
        "id",
        "title",
        "department",
        "status",
        "avg_difficulty",
        "avg_usefulness",
        "ratings_count",
    )
    list_select_related = ("department",)
    list_filter = ("department", "status")
    search_fields = ("title", "department__name")
    ordering = ("title",)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("department")


@admin.register(Faculty)
class FacultyAdmin(VersionAdmin):
    list_display = ("id", "name", "custom_abbreviation", "departments_count", "specialities_count")
    search_fields = ("name", "custom_abbreviation")
    ordering = ("name",)

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("departments", "specialities")

    @admin.display(description="Departments")
    def departments_count(self, obj):
        return obj.departments.count()

    @admin.display(description="Specialities")
    def specialities_count(self, obj):
        return obj.specialities.count()


@admin.register(Department)
class DepartmentAdmin(VersionAdmin):
    list_display = ("id", "name", "faculty", "courses_count")
    list_select_related = ("faculty",)
    list_filter = ("faculty",)
    search_fields = ("name", "faculty__name")
    ordering = ("name",)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("faculty").prefetch_related("courses")

    @admin.display(description="Courses")
    def courses_count(self, obj):
        return obj.courses.count()


@admin.register(Speciality)
class SpecialityAdmin(VersionAdmin):
    list_display = ("id", "name", "faculty", "alias", "courses_count")
    list_select_related = ("faculty",)
    list_filter = ("faculty",)
    search_fields = ("name", "faculty__name")
    ordering = ("name",)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("faculty").prefetch_related("courses")

    @admin.display(description="Courses")
    def courses_count(self, obj):
        return obj.courses.count()


@admin.register(CourseOffering)
class CourseOfferingAdmin(VersionAdmin):
    list_display = (
        "id",
        "course",
        "semester",
        "credits",
        "weekly_hours",
        "exam_type",
        "practice_type",
        "instructors_count",
        "enrollments_count",
    )
    list_select_related = ("course", "semester")
    list_filter = ("semester", "exam_type", "practice_type", "course__department")
    search_fields = ("course__title", "course__department__name")
    ordering = ("-semester__year", "-semester__term", "course__title")

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("course", "semester")
            .prefetch_related("instructors", "enrollments")
        )

    @admin.display(description="Instructors")
    def instructors_count(self, obj):
        return obj.instructors.count()

    @admin.display(description="Enrollments")
    def enrollments_count(self, obj):
        return obj.enrollments.count()


@admin.register(Instructor)
class InstructorAdmin(VersionAdmin):
    list_display = (
        "last_name",
        "first_name",
        "patronymic",
        "email",
        "courses_count",
    )
    search_fields = ("last_name", "first_name", "patronymic", "email")
    ordering = ("last_name", "first_name")

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("course_offerings")

    @admin.display(description="Courses")
    def courses_count(self, obj):
        return obj.course_offerings.count()


@admin.register(Enrollment)
class EnrollmentAdmin(VersionAdmin):
    list_display = ("id", "student", "offering", "status", "enrolled_at")
    list_select_related = ("student", "offering", "offering__course")
    list_filter = ("offering__course__department", "status", "enrolled_at")
    search_fields = (
        "student__last_name",
        "student__first_name",
        "student__patronymic",
        "offering__course__title",
    )
    ordering = ("-enrolled_at",)

    def get_queryset(self, request):
        return (
            super().get_queryset(request).select_related("student", "offering", "offering__course")
        )


@admin.register(Student)
class StudentAdmin(VersionAdmin):
    list_display = (
        "id",
        "last_name",
        "first_name",
        "patronymic",
        "speciality",
        "education_level",
    )
    list_select_related = ("speciality", "user")
    list_filter = ("education_level", "speciality__faculty")
    search_fields = ("last_name", "first_name", "patronymic", "speciality__name")
    ordering = ("last_name", "first_name")

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("speciality", "user")


@admin.register(Rating)
class RatingAdmin(VersionAdmin):
    list_display = (
        "id",
        "course_offering",
        "student",
        "difficulty",
        "usefulness",
        "comment_preview",
        "is_anonymous",
        "instructors_display",
        "created_at",
        "upvotes_count",
        "downvotes_count",
    )
    list_select_related = ("student", "course_offering", "course_offering__course")
    list_filter = (
        "is_anonymous",
        "difficulty",
        "usefulness",
        "created_at",
    )
    search_fields = (
        "student__last_name",
        "student__first_name",
        "course_offering__course__title",
        "comment",
    )
    ordering = ("-created_at",)
    readonly_fields = ("created_at",)

    def get_queryset(self, request):
        qs = (
            super()
            .get_queryset(request)
            .select_related(
                "student",
                "course_offering",
                "course_offering__course",
            )
            .prefetch_related("instructors")
            .annotate(
                _upvotes=Count(
                    "rating_vote",
                    filter=Q(rating_vote__type=RatingVoteType.UPVOTE),
                    distinct=True,
                ),
                _downvotes=Count(
                    "rating_vote",
                    filter=Q(rating_vote__type=RatingVoteType.DOWNVOTE),
                    distinct=True,
                ),
            )
        )
        return qs

    @admin.display(description="Upvotes", ordering="_upvotes")
    def upvotes_count(self, obj):
        return obj._upvotes

    @admin.display(description="Downvotes", ordering="_downvotes")
    def downvotes_count(self, obj):
        return obj._downvotes

    @admin.display(description="Instructors")
    def instructors_display(self, obj):
        instructors = obj.instructors.all()
        if not instructors:
            return "—"
        return ", ".join([f"{inst.first_name} {inst.last_name}" for inst in instructors])

    @admin.display(description="Comment")
    def comment_preview(self, obj):
        if not obj.comment:
            return "—"
        max_length = 100
        if len(obj.comment) > max_length:
            return f"{obj.comment[:max_length]}..."
        return obj.comment


@admin.register(Comment)
class CommentAdmin(VersionAdmin):
    list_display = (
        "id",
        "rating",
        "parent_comment",
        "user",
        "content",
        "is_anonymous",
        "created_at",
    )
    list_select_related = (
        "rating",
        "rating__course_offering",
        "rating__course_offering__course",
        "parent_comment",
        "user",
    )
    list_filter = (
        "is_anonymous",
        "created_at",
        "rating__course_offering__course__department",
    )
    search_fields = (
        "content",
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
        "rating__course_offering__course__title",
    )
    ordering = ("-created_at",)
    readonly_fields = ("created_at",)

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related(
                "rating",
                "rating__course_offering",
                "rating__course_offering__course",
                "rating__course_offering__course__department",
                "parent_comment",
                "user",
            )
        )


@admin.register(Semester)
class SemesterAdmin(VersionAdmin):
    list_display = ("year", "term")
    list_filter = ("year", "term")
    ordering = ("-year", "-term")

    def get_queryset(self, request):
        return super().get_queryset(request)

    @admin.display(description="Course Offerings")
    def course_offerings_count(self, obj):
        return obj.course_offerings.count()


@admin.register(RatingVote)
class RatingVoteAdmin(VersionAdmin):
    list_display = (
        "id",
        "student",
        "rating",
        "type",
    )
    search_fields = (
        "student__last_name",
        "student__first_name",
        "rating__course_offering__course__title",
    )
    ordering = ("rating__course_offering__course__title",)

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("student", "rating", "rating__course_offering")
        )


@admin.register(CourseInstructor)
class CourseInstructorAdmin(VersionAdmin):
    list_display = (
        "id",
        "instructor",
        "course_offering",
        "role",
    )
    list_select_related = ("instructor", "course_offering", "course_offering__course")
    list_filter = ("role", "course_offering__semester")
    search_fields = (
        "instructor__last_name",
        "instructor__first_name",
        "course_offering__course__title",
    )
    ordering = ("course_offering__course__title", "instructor__last_name")

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("instructor", "course_offering", "course_offering__course")
        )


@admin.register(CourseOfferingSpeciality)
class CourseOfferingSpecialityAdmin(VersionAdmin):
    list_display = (
        "id",
        "offering",
        "speciality",
        "type_kind",
    )
    list_select_related = ("offering__course", "speciality", "speciality__faculty")
    list_filter = ("type_kind", "speciality__faculty")
    search_fields = (
        "offering__course__title",
        "speciality__name",
    )
    ordering = ("offering__course__title", "speciality__name")

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("offering__course", "speciality", "speciality__faculty")
        )


@admin.register(PromoBanner)
class PromoBannerAdmin(VersionAdmin):
    list_display = ("title", "href", "is_active", "updated_at")
    list_filter = ("is_active",)
    list_editable = ("is_active",)
    search_fields = ("title", "description", "href")
    ordering = ("-updated_at",)
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (
            "Content",
            {
                "fields": ("title", "description", "cta_label", "href"),
                "description": "Text is shown in Ukrainian, exactly as entered.",
            },
        ),
        (
            "Logo",
            {"fields": ("logo", "logo_alt")},
        ),
        (
            "Visibility",
            {
                "fields": ("is_active", "created_at", "updated_at"),
                "description": (
                    "Only one banner can be active at a time; activating this "
                    "one deactivates any other. Create a new banner instead of "
                    "editing a live one so that users who dismissed the old ad "
                    "see the new one."
                ),
            },
        ),
    )

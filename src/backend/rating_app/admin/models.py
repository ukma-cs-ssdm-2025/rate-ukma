from django.contrib import admin
from django.db.models import Count, Q

from reversion.admin import VersionAdmin

from rating_app.models import (
    Course,
    CourseInstructor,
    CourseOffering,
    CourseSpeciality,
    Department,
    Enrollment,
    Faculty,
    Instructor,
    Rating,
    RatingVote,
    Semester,
    Speciality,
    Student,
)
from rating_app.models.choices import RatingVoteType


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
        "academic_degree",
        "academic_title",
        "courses_count",
    )
    list_filter = ("academic_degree", "academic_title")
    search_fields = ("last_name", "first_name", "patronymic")
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
        "ratings_count",
        "education_level",
    )
    list_select_related = ("speciality", "user")
    list_filter = ("education_level", "speciality__faculty")
    search_fields = ("last_name", "first_name", "patronymic", "speciality__name")
    ordering = ("last_name", "first_name")

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("speciality", "user")
            .annotate(
                _overall_rated_courses=Count("ratings__course_offering__course", distinct=True),
            )
        )

    @admin.display(description="Ratings", ordering="_overall_rated_courses")
    def ratings_count(self, obj):
        return obj._overall_rated_courses


@admin.register(Rating)
class RatingAdmin(VersionAdmin):
    list_display = (
        "id",
        "course_offering",
        "student",
        "difficulty",
        "usefulness",
        "comment",
        "is_anonymous",
        "created_at",
        "upvotes_count",
        "downvotes_count",
    )
    list_select_related = ("student", "course_offering", "course_offering__course")
    list_filter = (
        "is_anonymous",
        "difficulty",
        "usefulness",
        "course_offering__course__department",
        "created_at",
    )
    search_fields = (
        "student__last_name",
        "student__first_name",
        "course_offering__course__title",
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
                "course_offering__course__department",
            )
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


@admin.register(CourseSpeciality)
class CourseSpecialityAdmin(VersionAdmin):
    list_display = (
        "id",
        "course",
        "speciality",
        "type_kind",
    )
    list_select_related = ("course", "speciality", "speciality__faculty")
    list_filter = ("type_kind", "speciality__faculty")
    search_fields = (
        "course__title",
        "speciality__name",
    )
    ordering = ("course__title", "speciality__name")

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("course", "speciality", "speciality__faculty")
        )

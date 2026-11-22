from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model

import factory
from factory.django import DjangoModelFactory

from rating_app.ioc_container.repositories import rating_repository
from rating_app.ioc_container.services import feed_update_service
from rating_app.models import (
    CatalogMappingDecision,
    Comment,
    Course,
    CourseInstructor,
    CourseOffering,
    CourseOfferingSpeciality,
    CourseOfferingTerm,
    Department,
    Enrollment,
    Faculty,
    FeedPost,
    Instructor,
    MappingAnswer,
    PlannedCourse,
    PromoBanner,
    Rating,
    RatingVote,
    Semester,
    Speciality,
    Student,
    SyncApproval,
    SyncApprovalAction,
    SyncApprovalOutcome,
    SyncApprovalScope,
    SyncChange,
    SyncChangeGroup,
    SyncChangeState,
    SyncCursor,
    SyncPolicy,
    SyncPolicyChange,
    SyncPolicyMode,
    SyncPreview,
    SyncRun,
    SyncRunStatus,
    SyncSource,
)
from rating_app.models.choices import (
    CourseStatus,
    CourseTypeKind,
    EducationLevel,
    EnrollmentStatus,
    ExamType,
    FeedPostAccent,
    InstructorRole,
    PlanSlot,
    RatingVoteType,
    SemesterTerm,
)

User = get_user_model()


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
        # The password hook saves the row itself.
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"user{n}@ukma.edu.ua")
    username = factory.LazyAttribute(lambda user: user.email)

    @factory.post_generation
    def password(self, create, extracted, **kwargs):
        """Hash the password the way `create_user` would.

        Assigning `password=` on a model factory stores the raw string, leaving
        `check_password` and any real login failing for a reason no assertion
        explains. Hashing happens for `build()` too; only the save is skipped.
        """
        self.set_password(extracted or "test-password")
        if create:
            self.save(update_fields=["password"])


class FacultyFactory(DjangoModelFactory):
    class Meta:
        model = Faculty

    name = factory.Sequence(lambda n: f"Faculty {n}")


class DepartmentFactory(DjangoModelFactory):
    class Meta:
        model = Department

    name = factory.Sequence(lambda n: f"Department {n}")
    faculty = factory.SubFactory(FacultyFactory)


class SpecialityFactory(DjangoModelFactory):
    class Meta:
        model = Speciality

    name = factory.Sequence(lambda n: f"Speciality {n}")
    faculty = factory.SubFactory(FacultyFactory)


class CourseFactory(DjangoModelFactory):
    class Meta:
        model = Course

    title = factory.Sequence(lambda n: f"Course {n}")
    description = factory.Faker("sentence")
    status = CourseStatus.ACTIVE
    education_level = EducationLevel.BACHELOR
    department = factory.SubFactory(DepartmentFactory)


class SemesterFactory(DjangoModelFactory):
    class Meta:
        model = Semester
        django_get_or_create = ("year", "term")

    # Sequence, not fuzzy: the get_or_create key must not collide, or two calls
    # silently return the same semester.
    year = factory.Sequence(lambda n: 2018 + n)
    term = SemesterTerm.FALL


class InstructorFactory(DjangoModelFactory):
    class Meta:
        model = Instructor

    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    patronymic = factory.Faker("first_name")
    email = factory.Sequence(lambda n: f"instructor{n}@ukma.edu.ua")


class CourseOfferingFactory(DjangoModelFactory):
    class Meta:
        model = CourseOffering
        # Neither post-generation hook mutates the instance, so factory_boy 4's
        # default (no implicit re-save) is already correct here.
        skip_postgeneration_save = True

    code = factory.Sequence(lambda n: f"{100000 + n}")
    course = factory.SubFactory(CourseFactory)
    semester = factory.SubFactory(SemesterFactory)
    study_year = 1
    exam_type = ExamType.EXAM
    max_students = 60
    max_groups = 3
    group_size_min = 10
    group_size_max = 30

    @factory.post_generation
    def instructors(self, create, extracted, **kwargs):
        if not create or not extracted:
            return
        for instr in extracted:
            CourseInstructorFactory(
                course_offering=self,
                instructor=instr,
                role=InstructorRole.LECTURE_INSTRUCTOR,
            )


class CourseInstructorFactory(DjangoModelFactory):
    class Meta:
        model = CourseInstructor

    instructor = factory.SubFactory(InstructorFactory)
    course_offering = factory.SubFactory(CourseOfferingFactory)
    role = InstructorRole.LECTURE_INSTRUCTOR


class CourseOfferingTermFactory(DjangoModelFactory):
    class Meta:
        model = CourseOfferingTerm

    offering = factory.SubFactory(CourseOfferingFactory)
    semester = factory.SubFactory(SemesterFactory)
    credits = Decimal("3.0")
    weekly_hours = 4
    lecture_count = 16
    practice_count = 16
    practice_type = ""
    exam_type = ExamType.EXAM


class CourseOfferingSpecialityFactory(DjangoModelFactory):
    class Meta:
        model = CourseOfferingSpeciality

    offering = factory.SubFactory(CourseOfferingFactory)
    speciality = factory.SubFactory(SpecialityFactory)
    type_kind = CourseTypeKind.COMPULSORY


class StudentFactory(DjangoModelFactory):
    class Meta:
        model = Student

    class Params:
        # StudentFactory(with_user=True) links a fresh user; pass user= to link a
        # specific one.
        with_user = factory.Trait(user=factory.SubFactory(UserFactory))

    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    patronymic = factory.Faker("first_name")
    education_level = EducationLevel.BACHELOR
    user = None
    speciality = factory.SubFactory(SpecialityFactory)
    program_start_academic_year_start = 2022


class EnrollmentFactory(DjangoModelFactory):
    class Meta:
        model = Enrollment

    student = factory.SubFactory(StudentFactory)
    offering = factory.SubFactory(CourseOfferingFactory)
    status = EnrollmentStatus.ENROLLED


class PlannedCourseFactory(DjangoModelFactory):
    class Meta:
        model = PlannedCourse

    student = factory.SubFactory(StudentFactory)
    offering = factory.SubFactory(CourseOfferingFactory)
    academic_year_start = 2025
    term = SemesterTerm.FALL
    slot = PlanSlot.MAIN


class RatingFactory(DjangoModelFactory):
    class Meta:
        model = Rating
        skip_postgeneration_save = True

    student = factory.SubFactory(StudentFactory)
    course_offering = factory.SubFactory(CourseOfferingFactory)
    difficulty = 3
    usefulness = 4
    comment = factory.Sequence(lambda n: f"Rating comment {n}")
    is_anonymous = False

    @factory.post_generation
    def sync_feed(self, create, extracted, **kwargs):
        if not create:
            return

        feed_update_service().sync_rating(rating_repository().get_by_id(str(self.id)))


class RatingVoteFactory(DjangoModelFactory):
    class Meta:
        model = RatingVote

    student = factory.SubFactory(StudentFactory)
    rating = factory.SubFactory(RatingFactory)
    type = RatingVoteType.UPVOTE


class CommentFactory(DjangoModelFactory):
    class Meta:
        model = Comment
        # The hook only replays the feed observer; it never mutates the instance.
        skip_postgeneration_save = True

    content = factory.Faker("paragraph")
    rating = factory.SubFactory(RatingFactory)
    user = factory.SubFactory(UserFactory)
    parent_comment = None
    is_anonymous = False

    @factory.post_generation
    def sync_feed(self, create, extracted, **kwargs):
        if not create:
            return
        from rating_app.ioc_container.repositories import comment_repository
        from rating_app.ioc_container.services import feed_update_service

        feed_update_service().sync_comment(comment_repository().get_by_id(str(self.id)))


class FeedPostFactory(DjangoModelFactory):
    class Meta:
        model = FeedPost

    title = factory.Sequence(lambda n: f"Feed post {n}")
    body = factory.Faker("paragraph")
    accent = FeedPostAccent.BRAND
    pinned = False
    is_active = True


class PromoBannerFactory(DjangoModelFactory):
    class Meta:
        model = PromoBanner

    title = factory.Sequence(lambda n: f"Promo {n}")
    description = factory.Faker("sentence")
    href = factory.Sequence(lambda n: f"https://example.com/promo/{n}")
    cta_label = "Open"
    logo_alt = ""
    is_active = False


class SyncRunFactory(DjangoModelFactory):
    class Meta:
        model = SyncRun

    source = SyncSource.CATALOG
    status = SyncRunStatus.RUNNING


class SyncChangeFactory(DjangoModelFactory):
    class Meta:
        model = SyncChange

    run = factory.SubFactory(SyncRunFactory)
    source = SyncSource.CATALOG
    group = SyncChangeGroup.LINK
    kind = "link_course"
    key = factory.Sequence(lambda n: f"change:{n}")
    state = SyncChangeState.PROPOSED
    ratings = 0


class SyncPolicyFactory(DjangoModelFactory):
    class Meta:
        model = SyncPolicy

    kind = factory.Sequence(lambda n: f"policy_kind_{n}")
    mode = SyncPolicyMode.NEEDS_APPROVAL
    updated_by = factory.SubFactory(UserFactory)


class SyncPolicyChangeFactory(DjangoModelFactory):
    class Meta:
        model = SyncPolicyChange

    kind = factory.Sequence(lambda n: f"policy_kind_{n}")
    old_mode = SyncPolicyMode.NEEDS_APPROVAL
    new_mode = SyncPolicyMode.AUTO
    user = factory.SubFactory(UserFactory)


class SyncApprovalFactory(DjangoModelFactory):
    class Meta:
        model = SyncApproval

    run = factory.SubFactory(SyncRunFactory)
    run_ref = factory.LazyAttribute(lambda approval: approval.run.pk)
    action = SyncApprovalAction.APPLY
    scope = SyncApprovalScope.CHANGE
    user = None
    outcome = SyncApprovalOutcome.STARTED
    counts = factory.LazyFunction(dict)


class SyncPreviewFactory(DjangoModelFactory):
    class Meta:
        model = SyncPreview

    token = factory.Sequence(lambda n: f"preview-token-{n}")
    run = factory.SubFactory(SyncRunFactory)
    user = factory.SubFactory(UserFactory)
    count = 1


class CatalogMappingDecisionFactory(DjangoModelFactory):
    class Meta:
        model = CatalogMappingDecision

    kind = "merge_courses"
    question_key = factory.Sequence(lambda n: f"merge:ud_course_{n}")
    ukma_course_id = factory.Sequence(lambda n: f"ud_course_{n}")
    course = factory.SubFactory(CourseFactory)
    offering = None
    answer = MappingAnswer.KEEP_APART
    premise = factory.LazyFunction(dict)
    decided_by = factory.SubFactory(UserFactory)


class SyncCursorFactory(DjangoModelFactory):
    class Meta:
        model = SyncCursor

    source = SyncSource.CATALOG
    list_name = factory.Sequence(lambda n: f"list_{n}")
    change_no = 0

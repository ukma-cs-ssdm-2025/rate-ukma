from __future__ import annotations

import random

import factory
from factory import fuzzy
from factory.django import DjangoModelFactory
from faker import Faker

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
    Semester,
    Speciality,
    Student,
)
from rating_app.models.choices import (
    AcademicDegree,
    AcademicTitle,
    CourseStatus,
    CourseTypeKind,
    EducationLevel,
    InstructorRole,
    SemesterTerm,
)

faker = Faker()


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
    department = factory.SubFactory(DepartmentFactory)


class SemesterFactory(DjangoModelFactory):
    class Meta:
        model = Semester
        django_get_or_create = ("year", "term")

    year = fuzzy.FuzzyInteger(2018, 2026)
    term = fuzzy.FuzzyChoice(SemesterTerm.values)


class InstructorFactory(DjangoModelFactory):
    class Meta:
        model = Instructor

    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    patronymic = factory.Faker("first_name")
    academic_degree = AcademicDegree.PHD
    academic_title = AcademicTitle.ASSISTANT


class CourseOfferingFactory(DjangoModelFactory):
    class Meta:
        model = CourseOffering

    code = factory.LazyFunction(lambda: f"{random.randint(100000, 999999)}")  # 6 символів
    course = factory.SubFactory(CourseFactory)
    semester = factory.SubFactory(SemesterFactory)
    credits = fuzzy.FuzzyDecimal(1, 6, precision=1)
    weekly_hours = fuzzy.FuzzyInteger(1, 12)
    lecture_count = fuzzy.FuzzyInteger(4, 32)
    practice_count = fuzzy.FuzzyInteger(0, 20)
    practice_type = ""
    exam_type = "EXAM"
    max_students = fuzzy.FuzzyInteger(10, 200)
    max_groups = fuzzy.FuzzyInteger(1, 6)
    group_size_min = fuzzy.FuzzyInteger(5, 30)
    group_size_max = fuzzy.FuzzyInteger(20, 200)

    @factory.post_generation
    def instructors(self, create, extracted, **kwargs):
        if not create or not extracted:
            return
        for instr in extracted:
            CourseInstructorFactory(
                course_offering=self,
                instructor=instr,
                role="LECTURE_INSTRUCTOR",
            )


class CourseInstructorFactory(DjangoModelFactory):
    class Meta:
        model = CourseInstructor

    instructor = factory.SubFactory(InstructorFactory)
    course_offering = factory.SubFactory(CourseOfferingFactory)
    role = InstructorRole.LECTURE_INSTRUCTOR


class CourseSpecialityFactory(DjangoModelFactory):
    class Meta:
        model = CourseSpeciality

    course = factory.SubFactory(CourseFactory)
    speciality = factory.SubFactory(SpecialityFactory)
    type_kind = CourseTypeKind.COMPULSORY


class StudentFactory(DjangoModelFactory):
    class Meta:
        model = Student

    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    patronymic = factory.Faker("first_name")
    education_level = EducationLevel.BACHELOR
    user = None
    speciality = factory.SubFactory(SpecialityFactory)


class EnrollmentFactory(DjangoModelFactory):
    class Meta:
        model = Enrollment

    student = factory.SubFactory(StudentFactory)
    offering = factory.SubFactory(CourseOfferingFactory)
    status = "ENROLLED"


class RatingFactory(DjangoModelFactory):
    class Meta:
        model = Rating

    student = factory.SubFactory(StudentFactory)
    course_offering = factory.SubFactory(CourseOfferingFactory)
    difficulty = fuzzy.FuzzyInteger(1, 5)
    usefulness = fuzzy.FuzzyInteger(1, 5)
    is_anonymous = False

    @factory.lazy_attribute
    def comment(self):
        return faker.sentence() if random.random() < 0.5 else ""


class SemesterFactory(DjangoModelFactory):
    class Meta:
        model = Semester

    year = fuzzy.FuzzyInteger(2018, 2026)
    term = fuzzy.FuzzyChoice(SemesterTerm.values)

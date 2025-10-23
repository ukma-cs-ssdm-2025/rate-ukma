from rating_app.models import CourseInstructor, CourseOffering, Instructor


class CourseInstructorRepository:
    def get_all(self) -> list[CourseInstructor]:
        return list(CourseInstructor.objects.select_related("instructor", "course_offering").all())

    def get_by_id(self, course_instructor_id: str) -> CourseInstructor:
        return CourseInstructor.objects.select_related("instructor", "course_offering").get(
            id=course_instructor_id
        )

    def get_or_create(
        self,
        *,
        instructor: Instructor,
        course_offering: CourseOffering,
        role: str,
    ) -> tuple[CourseInstructor, bool]:
        return CourseInstructor.objects.get_or_create(
            instructor=instructor, course_offering=course_offering, role=role
        )

    def create(self, **ci_data) -> CourseInstructor:
        return CourseInstructor.objects.create(**ci_data)

    def update(self, course_instructor: CourseInstructor, **ci_data) -> CourseInstructor:
        for field, value in ci_data.items():
            setattr(course_instructor, field, value)
        course_instructor.save()
        return course_instructor

    def delete(self, course_instructor: CourseInstructor) -> None:
        course_instructor.delete()

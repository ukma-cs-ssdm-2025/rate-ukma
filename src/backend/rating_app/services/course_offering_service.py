from rating_app.models import CourseOffering
from rating_app.repositories import CourseOfferingRepository


class CourseOfferingService:
    def __init__(
        self,
        course_offering_repository: CourseOfferingRepository,
    ):
        self.course_offering_repository = course_offering_repository

    def list_course_offerings(self) -> list[CourseOffering]:
        return self.course_offering_repository.get_all()

    def get_course_offering(self, course_offering_id: str) -> CourseOffering:
        return self.course_offering_repository.get_by_id(course_offering_id)

    def get_course_offerings_by_course(self, course_id: str) -> list[CourseOffering]:
        return self.course_offering_repository.get_by_course(course_id)

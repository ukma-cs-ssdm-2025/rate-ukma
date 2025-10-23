from typing import Any

from rest_framework import viewsets
from rest_framework.response import Response

from rating_app.ioc_container.services import instructor_service
from rating_app.serializers import InstructorSerializer


class InstructorViewSet(viewsets.ModelViewSet):
    serializer_class = InstructorSerializer

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.instructor_service = instructor_service()

    def retrieve(self, request, instructor_id=None):
        instructor = self.instructor_service.get_instructor_by_id(instructor_id)
        serializer = self.get_serializer(instructor)
        return Response(serializer.data)

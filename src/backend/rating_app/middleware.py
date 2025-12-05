from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.utils.functional import SimpleLazyObject


def _get_user_with_profile(request):
    user_model = get_user_model()
    user_id = request.session.get("_auth_user_id")
    if not user_id:
        return AnonymousUser()

    user = user_model.objects.select_related("student_profile").filter(pk=user_id).first()
    return user or AnonymousUser()


class UserProfileMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if hasattr(request, "user"):
            request.user = SimpleLazyObject(lambda: _get_user_with_profile(request))
        return self.get_response(request)

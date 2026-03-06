import json

from django.contrib.auth import get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.middleware.csrf import _get_new_csrf_string, _mask_cipher_secret

import structlog

logger = structlog.get_logger(__name__)

User = get_user_model()

LOAD_TEST_USERNAME_PREFIX = "loadtest_"


class Command(BaseCommand):
    help = (
        "Create test user accounts with Django sessions for load testing. "
        "Run this command on the server where the database lives. "
        "Outputs a JSON file with sessionid and csrftoken cookie values. "
        "Copy the JSON file to your local machine to use with Locust."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=200,
            help="Number of test users to create (default: 200)",
        )
        parser.add_argument(
            "--output",
            type=str,
            default="load_test_sessions.json",
            help="Output JSON file path (default: load_test_sessions.json)",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Remove existing load test users and their sessions before creating new ones",
        )

    def handle(self, *args, **options):
        from rating_app.models import Speciality

        count = options["count"]
        output_path = options["output"]

        if count < 1:
            raise CommandError("--count must be at least 1")

        if options["clear"]:
            self._clear_existing()

        speciality = Speciality.objects.first()
        if speciality is None:
            raise CommandError(
                "No Speciality found in the database. "
                "Run 'generate_mock_data' first to populate reference data."
            )

        sessions = []

        self.stdout.write(f"Creating {count} load test users with sessions...")

        for i in range(count):
            username = f"{LOAD_TEST_USERNAME_PREFIX}{i}"

            with transaction.atomic():
                user, _created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        "email": f"{username}@loadtest.local",
                        "first_name": "Load",
                        "last_name": f"Tester{i}",
                    },
                )

                if not hasattr(user, "student_profile") or user.student_profile is None:
                    from rating_app.models import Student

                    Student.objects.create(
                        first_name=user.first_name,
                        last_name=user.last_name,
                        education_level="BACHELOR",
                        email=user.email,
                        user=user,
                        speciality=speciality,
                    )

                # Create a real Django session with extended expiry for load testing
                session = SessionStore()
                session["_auth_user_id"] = str(user.pk)
                session["_auth_user_backend"] = "django.contrib.auth.backends.ModelBackend"
                session["_auth_user_hash"] = user.get_session_auth_hash()
                session.set_expiry(60 * 60 * 24 * 7)  # 7 days
                session.create()

                csrf_token = _mask_cipher_secret(_get_new_csrf_string())

                sessions.append(
                    {
                        "username": username,
                        "sessionid": session.session_key,
                        "csrftoken": csrf_token,
                    }
                )

            if (i + 1) % 50 == 0:
                self.stdout.write(f"  Created {i + 1}/{count}...")

        with open(output_path, "w") as f:
            json.dump(sessions, f, indent=2)

        logger.info(
            "load_test_sessions_created",
            count=len(sessions),
            output_path=output_path,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Created {len(sessions)} sessions → {output_path}\n"
                f"Copy this file to your local machine and run Locust."
            )
        )

    def _clear_existing(self):
        from django.contrib.sessions.models import Session

        from rating_app.models import Student

        users = User.objects.filter(username__startswith=LOAD_TEST_USERNAME_PREFIX)
        user_ids = list(users.values_list("id", flat=True))

        if not user_ids:
            self.stdout.write("No existing load test users found.")
            return

        # Delete sessions belonging to these users
        str_ids = [str(uid) for uid in user_ids]
        deleted_sessions = 0
        for session in Session.objects.iterator():
            data = session.get_decoded()
            if data.get("_auth_user_id") in str_ids:
                session.delete()
                deleted_sessions += 1

        students_deleted, _ = Student.objects.filter(user_id__in=user_ids).delete()
        users_deleted, _ = users.delete()

        self.stdout.write(
            self.style.WARNING(
                f"Cleared {users_deleted} users, {students_deleted} students, "
                f"{deleted_sessions} sessions."
            )
        )

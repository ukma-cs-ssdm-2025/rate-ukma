import random

from django.core.management.base import BaseCommand
from django.db import transaction

import structlog

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Generate realistic ratings for existing course offerings"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing ratings before generating new ones",
        )
        parser.add_argument(
            "--count",
            type=int,
            default=None,
            help="Number of ratings to generate (default: auto based on offerings)",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from ...models import (
            CourseOffering,
            Rating,
            Student,
        )

        if options["clear"]:
            logger.info("ratings_clear_start")
            count_before = Rating.objects.count()
            Rating.objects.all().delete()
            logger.info("ratings_cleared", count=count_before)
            self.stdout.write(self.style.WARNING(f"Cleared {count_before} existing ratings"))

        students = list(Student.objects.all())
        if not students:
            self.stdout.write(
                self.style.ERROR(
                    "No students found in database. Run 'python manage.py setup_base_data' first."
                )
            )
            return

        course_offerings = list(CourseOffering.objects.all())
        if not course_offerings:
            self.stdout.write(
                self.style.ERROR(
                    "No course offerings found in database. Run 'python manage.py setup_base_data' first."
                )
            )
            return

        logger.info("ratings_generation_start", students=len(students), offerings=len(course_offerings))

        rating_comments = [
            "Дуже корисний курс, рекомендую всім. Викладач пояснює зрозуміло.",
            "Складний, але дуже цікавий матеріал. Багато самостійної роботи.",
            "Чудовий викладач, все пояснює на прикладах. Практика дуже допомогла.",
            "Курс вимагає багато часу, але результат вартий зусиль.",
            "Організація курсу могла б бути кращою, але матеріал корисний.",
            "Дуже актуальний матеріал, особливо для сучасного ринку праці.",
            "Складно було встигати за графіком, але викладач йшов назустріч.",
            "Багато теорії, хотілося б більше практичних завдань.",
            "Рекомендую обов'язково відвідувати лекції та практику.",
            "Відмінний курс, все сподобалось. Буду використовувати знання на практиці.",
        ]

        ratings = []

        rated_offerings = random.sample(course_offerings, int(len(course_offerings) * 0.7))

        for offering in rated_offerings:
            num_ratings = random.randint(3, 12)
            selected_students = random.sample(students, min(num_ratings, len(students)))

            for student in selected_students:
                if not Rating.objects.filter(student=student, course_offering=offering).exists():
                    difficulty = random.choices([1, 2, 3, 4, 5], weights=[5, 15, 35, 30, 15])[0]
                    usefulness = random.choices([1, 2, 3, 4, 5], weights=[5, 10, 25, 35, 25])[0]

                    rating = Rating.objects.create(
                        student=student,
                        course_offering=offering,
                        difficulty=difficulty,
                        usefulness=usefulness,
                        comment=random.choice(rating_comments),
                        is_anonymous=random.choice([True, False]),
                    )
                    ratings.append(rating)

        logger.info("ratings_created", count=len(ratings))

        self.stdout.write(
            self.style.SUCCESS(
                f"\nSuccessfully generated {len(ratings)} ratings for {len(rated_offerings)} course offerings"
            )
        )

        self.stdout.write("\nUsage:")
        self.stdout.write("  python manage.py generate_ratings          # Generate ratings")
        self.stdout.write("  python manage.py generate_ratings --clear  # Clear and regenerate")

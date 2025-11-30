import random

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

import structlog

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Generate mock ratings for real courses in the database"

    def add_arguments(self, parser):
        parser.add_argument(
            "--courses",
            type=int,
            default=10,
            help="Number of courses to generate ratings for (default: 10)",
        )
        parser.add_argument(
            "--min-ratings",
            type=int,
            default=2,
            help="Minimum number of ratings per course (default: 2)",
        )
        parser.add_argument(
            "--max-ratings",
            type=int,
            default=50,
            help="Maximum number of ratings per course (default: 50)",
        )
        parser.add_argument(
            "--clean",
            action="store_true",
            help=(
                "Clear all existing ratings before generating new ones "
                "(LOCAL DEVELOPMENT ONLY – deletes all ratings)"
            ),
        )
        parser.add_argument(
            "--clean-only",
            action="store_true",
            help=(
                "Only clear existing ratings without generating new ones "
                "(LOCAL DEVELOPMENT ONLY – deletes all ratings)"
            ),
        )

    def _confirm_clear(self) -> bool:
        self.stdout.write("")
        self.stdout.write(
            self.style.WARNING(
                "You are about to DELETE ALL ratings from the database.\n"
                "This is intended for LOCAL development only.\n"
            )
        )
        self.stdout.write(
            "Type 'yes' to continue, or anything else to abort: ",
        )
        try:
            answer = input()
        except EOFError:
            logger.warning("ratings_clear_confirmation_failed", reason="no_input")
            self.stdout.write(self.style.ERROR("No input received. Aborting."))
            return False

        if answer.strip().lower() != "yes":
            logger.info("ratings_clear_aborted", answer=answer.strip())
            self.stdout.write(self.style.ERROR("Aborted. No ratings were deleted."))
            return False

        logger.info("ratings_clear_confirmed")
        return True

    @transaction.atomic
    def handle(self, *args, **options):
        from ...models import CourseOffering, Rating, Student

        if options["clean"] and options["clean_only"]:
            raise CommandError("Cannot use --clean and --clean-only options together.")

        num_courses = options["courses"]
        min_ratings = options["min_ratings"]
        max_ratings = options["max_ratings"]

        if min_ratings < 1:
            raise CommandError("--min-ratings must be at least 1")

        if max_ratings < min_ratings:
            raise CommandError("--max-ratings must be greater than or equal to --min-ratings")

        if options["clean_only"]:
            if not self._confirm_clear():
                return

            logger.info("ratings_clear_start")
            deleted_count = Rating.objects.all().count()
            Rating.objects.all().delete()

            logger.info("ratings_clear_complete", count=deleted_count)
            self.stdout.write(
                self.style.SUCCESS(
                    f"\n{deleted_count} ratings have been successfully cleared from the database."
                )
            )
            return

        if options["clean"]:
            if not self._confirm_clear():
                return

            logger.info("ratings_clear_start")
            deleted_count = Rating.objects.all().count()
            Rating.objects.all().delete()
            logger.info("ratings_cleared", count=deleted_count)
            self.stdout.write(self.style.SUCCESS(f"Cleared {deleted_count} existing ratings."))

        logger.info("mock_ratings_generation_start")

        # Get real students from the database
        students = list(Student.objects.all())
        if not students:
            raise CommandError(
                "No students found in the database. Please create students first or run "
                "'python manage.py generate_mock_data' to generate mock data."
            )

        # Get real course offerings from the database
        all_course_offerings = list(CourseOffering.objects.all())
        if not all_course_offerings:
            raise CommandError(
                "No course offerings found in the database."
                "Please create course offerings first or run "
                "'python manage.py generate_mock_data' to generate mock data."
            )

        # Select random course offerings to rate
        num_courses_to_rate = min(num_courses, len(all_course_offerings))
        selected_offerings = random.sample(all_course_offerings, num_courses_to_rate)

        logger.info(
            "selected_courses",
            total_courses=len(all_course_offerings),
            selected=num_courses_to_rate,
        )

        # Rating comments pool
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
            "Викладач дуже вимогливий, але справедливий. Багато чому навчився.",
            "Цікаві практичні завдання, які готують до реальної роботи.",
            "Хотілося б більше часу на виконання домашніх завдань.",
            "Курс перевершив очікування, дуже задоволений.",
            "Матеріал складний, але викладач завжди готовий допомогти.",
            "Практична частина курсу особливо корисна.",
            "Рекомендую проходити попередню підготовку перед курсом.",
            "Дуже багато нової інформації, треба добре працювати.",
            "Викладач справжній професіонал своєї справи.",
            "Курс вимагає постійної роботи протягом семестру.",
        ]

        # Define different rating profile types for more variance
        rating_profiles = [
            # Excellent course - mostly high ratings
            {
                "name": "excellent",
                "difficulty_weights": [3, 10, 25, 35, 27],
                "usefulness_weights": [2, 5, 15, 35, 43],
            },
            # Good course - above average
            {
                "name": "good",
                "difficulty_weights": [5, 15, 30, 35, 15],
                "usefulness_weights": [5, 10, 20, 40, 25],
            },
            # Average course - balanced
            {
                "name": "average",
                "difficulty_weights": [10, 20, 35, 25, 10],
                "usefulness_weights": [10, 20, 35, 25, 10],
            },
            # Below average course
            {
                "name": "below_average",
                "difficulty_weights": [15, 30, 30, 20, 5],
                "usefulness_weights": [20, 30, 30, 15, 5],
            },
            # Poor course - mostly low ratings
            {
                "name": "poor",
                "difficulty_weights": [25, 35, 25, 10, 5],
                "usefulness_weights": [30, 35, 20, 10, 5],
            },
            # Very difficult but useful
            {
                "name": "challenging",
                "difficulty_weights": [2, 5, 15, 35, 43],
                "usefulness_weights": [3, 8, 20, 35, 34],
            },
            # Easy but not very useful
            {
                "name": "easy",
                "difficulty_weights": [30, 35, 20, 10, 5],
                "usefulness_weights": [15, 25, 35, 20, 5],
            },
        ]

        ratings_created = 0

        for offering in selected_offerings:
            # Randomly assign a rating profile to this course offering
            profile = random.choice(rating_profiles)

            # Generate random number of ratings for this offering
            num_ratings = random.randint(min_ratings, max_ratings)

            # Don't try to select more students than available
            num_ratings = min(num_ratings, len(students))

            # Randomly select students for this offering
            selected_students = random.sample(students, num_ratings)

            for student in selected_students:
                # Check if student hasn't already rated this offering
                if not Rating.objects.filter(student=student, course_offering=offering).exists():
                    # Use the profile's weights for this course
                    difficulty = random.choices(
                        [1, 2, 3, 4, 5], weights=profile["difficulty_weights"]
                    )[0]
                    usefulness = random.choices(
                        [1, 2, 3, 4, 5], weights=profile["usefulness_weights"]
                    )[0]

                    Rating.objects.create(
                        student=student,
                        course_offering=offering,
                        difficulty=difficulty,
                        usefulness=usefulness,
                        comment=random.choice(rating_comments),
                        is_anonymous=random.choice([True, False]),
                    )
                    ratings_created += 1

        logger.info("mock_ratings_generation_complete", count=ratings_created)

        self.stdout.write(
            self.style.SUCCESS(
                f"\nSuccessfully generated {ratings_created} mock ratings!\n"
                f"Rated courses: {num_courses_to_rate}\n"
                f"Total students: {len(students)}\n"
                f"Ratings per course: {min_ratings}-{max_ratings}"
            )
        )

        self.stdout.write("\n" + self.style.SUCCESS("Usage examples:"))
        self.stdout.write("  python manage.py generate_mock_ratings")
        self.stdout.write("  python manage.py generate_mock_ratings --courses 20")
        self.stdout.write(
            "  python manage.py generate_mock_ratings --courses 15 --min-ratings 5 --max-ratings 30"
        )
        self.stdout.write("  python manage.py generate_mock_ratings --clean --courses 10")
        self.stdout.write("  python manage.py generate_mock_ratings --clean-only")

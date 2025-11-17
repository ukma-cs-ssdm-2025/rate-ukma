import random

from django.core.management.base import BaseCommand
from django.db import transaction

import structlog

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Set up base NaUKMA data: faculties, departments, specialities, courses, instructors, and students"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear ALL existing data before generating (including ratings)",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from ...models import (
            Course,
            CourseInstructor,
            CourseOffering,
            Department,
            Faculty,
            Instructor,
            Rating,
            Semester,
            Speciality,
            Student,
        )
        from ...models.choices import (
            AcademicDegree,
            AcademicTitle,
            CourseStatus,
            EducationLevel,
            ExamType,
            PracticeType,
            SemesterTerm,
        )

        if options["clear"]:
            logger.info("base_data_clear_start")
            Rating.objects.all().delete()
            CourseInstructor.objects.all().delete()
            CourseOffering.objects.all().delete()
            Student.objects.all().delete()
            Course.objects.all().delete()
            Instructor.objects.all().delete()
            Speciality.objects.all().delete()
            Department.objects.all().delete()
            Faculty.objects.all().delete()
            Semester.objects.all().delete()

        logger.info("base_data_generation_start")

        faculties_data = [
            {
                "name": "Факультет інформатики",
                "departments": [
                    "Кафедра теоретичної інформатики",
                    "Кафедра програмної інженерії",
                    "Кафедра комп'ютерних наук",
                ],
            },
            {
                "name": "Факультет економічних наук",
                "departments": [
                    "Кафедра економічної теорії",
                    "Кафедра фінансів",
                    "Кафедра менеджменту",
                ],
            },
            {
                "name": "Факультет правничих наук",
                "departments": [
                    "Кафедра конституційного та міжнародного права",
                    "Кафедра кримінального права та кримінології",
                    "Кафедра цивільного права",
                ],
            },
            {
                "name": "Факультет гуманітарних наук",
                "departments": [
                    "Кафедра історії",
                    "Кафедра філософії та релігієзнавства",
                    "Кафедра української мови та літератури",
                ],
            },
            {
                "name": "Факультет соціальних наук і соціальних технологій",
                "departments": ["Кафедра соціології", "Кафедра психології", "Кафедра політології"],
            },
            {
                "name": "Факультет природничих наук",
                "departments": [
                    "Кафедра загальної та неорганічної хімії",
                    "Кафедра екології",
                ],
            },
        ]

        faculties = {}
        for faculty_data in faculties_data:
            faculty = Faculty.objects.create(name=faculty_data["name"])
            faculties[faculty.name] = faculty

            for dept_name in faculty_data["departments"]:
                Department.objects.create(name=dept_name, faculty=faculty)

        logger.info("faculties_created", count=len(faculties))

        specialities_data = [
            ("Комп'ютерні науки", "Факультет інформатики"),
            ("Прикладна математика", "Факультет інформатики"),
            ("Економіка", "Факультет економічних наук"),
            ("Фінанси, банківська справа та страхування", "Факультет економічних наук"),
            ("Право", "Факультет правничих наук"),
            ("Публічне управління та адміністрування", "Факультет правничих наук"),
            ("Історія та археологія", "Факультет гуманітарних наук"),
            ("Філософія", "Факультет гуманітарних наук"),
            ("Соціологія", "Факультет соціальних наук і соціальних технологій"),
            ("Психологія", "Факультет соціальних наук і соціальних технологій"),
            ("Політологія", "Факультет соціальних наук і соціальних технологій"),
            ("Українська мова та література", "Факультет гуманітарних наук"),
        ]

        specialities = {}
        for spec_name, faculty_name in specialities_data:
            speciality = Speciality.objects.create(name=spec_name, faculty=faculties[faculty_name])
            specialities[spec_name] = speciality

        logger.info("specialities_created", count=len(specialities))

        semesters = []
        for year in range(2023, 2027):
            for term in [SemesterTerm.FALL, SemesterTerm.SPRING]:
                semester, created = Semester.objects.get_or_create(year=year, term=term)
                semesters.append(semester)

        for year in range(2024, 2026):
            semester, created = Semester.objects.get_or_create(year=year, term=SemesterTerm.SUMMER)
            semesters.append(semester)

        logger.info("semesters_created", count=len(semesters))

        ukrainian_first_names = [
            "Олександр",
            "Андрій",
            "Ігор",
            "Сергій",
            "Володимир",
            "Михайло",
            "Юрій",
            "Тарас",
            "Богдан",
            "Ростислав",
            "Віктор",
            "Олег",
            "Павло",
            "Дмитро",
            "Василь",
        ]

        ukrainian_last_names = [
            "Ковальчук",
            "Шевченко",
            "Бондаренко",
            "Мельник",
            "Кравченко",
            "Петренко",
            "Іваненко",
            "Павленко",
            "Савченко",
            "Козак",
            "Мороз",
            "Попов",
            "Лисенко",
            "Ткаченко",
            "Козаченко",
        ]

        ukrainian_patronymics = [
            "Олександрович",
            "Андрійович",
            "Сергійович",
            "Володимирович",
            "Михайлович",
            "Юрійович",
            "Тарасович",
            "Богданович",
            "Ростиславович",
            "Вікторович",
            "Олегович",
            "Павлович",
            "Дмитрович",
            "Васильович",
            "Іванович",
        ]

        instructors = []
        for i in range(30):
            instructor = Instructor.objects.create(
                first_name=random.choice(ukrainian_first_names),
                last_name=random.choice(ukrainian_last_names),
                patronymic=random.choice(ukrainian_patronymics),
                academic_degree=random.choice(
                    [AcademicDegree.PHD, AcademicDegree.DOCTOR_OF_SCIENCES]
                ),
                academic_title=random.choice(
                    [
                        AcademicTitle.LECTURER,
                        AcademicTitle.SENIOR_LECTURER,
                        AcademicTitle.ASSOCIATE_PROF,
                        AcademicTitle.PROFESSOR,
                    ]
                ),
            )
            instructors.append(instructor)

        logger.info("instructors_created", count=len(instructors))

        ukrainian_student_first = [
            "Анна",
            "Марія",
            "Олена",
            "Ірина",
            "Наталія",
            "Тетяна",
            "Людмила",
            "Катерина",
            "Оксана",
            "Юлія",
            "Вікторія",
            "Інна",
            "Світлана",
            "Ольга",
            "Іван",
            "Петро",
            "Микола",
            "Олександр",
            "Андрій",
            "Дмитро",
            "Олег",
            "Тарас",
            "Богдан",
            "Ростислав",
            "Володимир",
            "Михайло",
            "Юрій",
        ]

        ukrainian_student_last = [
            "Шевченко",
            "Ковальчук",
            "Бондаренко",
            "Мельник",
            "Кравченко",
            "Петренко",
            "Іваненко",
            "Павленко",
            "Савченко",
            "Козак",
            "Мороз",
            "Попов",
            "Лисенко",
            "Ткаченко",
            "Козаченко",
        ]

        students = []
        for i in range(40):
            student = Student.objects.create(
                first_name=random.choice(ukrainian_student_first),
                last_name=random.choice(ukrainian_student_last),
                education_level=random.choice([EducationLevel.BACHELOR, EducationLevel.MASTER]),
                speciality=random.choice(Speciality.objects.all()),
            )
            students.append(student)

        logger.info("students_created", count=len(students))

        courses_data = [
            # (keeping the same courses_data structure from original file - truncated for brevity)
            {
                "title": "Аналіз великих даних (Big Data)",
                "description": "Вивчення методів та інструментів обробки великих обсягів даних, аналіз даних у реальному часі",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Машинне навчання",
                "description": "Алгоритми машинного навчання, нейронні мережі, глибинне навчання та їх практичне застосування",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки", "Прикладна математика"],
            },
            {
                "title": "Алгоритми та структури даних",
                "description": "Фундаментальні алгоритми сортування, пошуку, структури даних, аналіз складності",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки", "Прикладна математика"],
            },
            {
                "title": "Веб-технології та розробка додатків",
                "description": "HTML5, CSS3, JavaScript, React, Angular, бекенд розробка, REST API",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Кібербезпека та криптографія",
                "description": "Основи інформаційної безпеки, криптографічні алгоритми, симетричне та асиметричне шифрування",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Мікроекономіка",
                "description": "Теорія поведінки споживачів та фірм, ринкова рівновага, теорія ігор",
                "faculty": "Факультет економічних наук",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Економіка", "Фінанси, банківська справа та страхування"],
            },
            {
                "title": "Макроекономіка",
                "description": "Аналіз економічних систем, ВВП, інфляція, безробіття, грошово-кредитна політика",
                "faculty": "Факультет економічних наук",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Економіка", "Фінанси, банківська справа та страхування"],
            },
            {
                "title": "Конституційне право України",
                "description": "Основи конституційного ладу, права та свободи людини, конституційний контроль",
                "faculty": "Факультет правничих наук",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Право", "Публічне управління та адміністрування"],
            },
            {
                "title": "Історія України",
                "description": "Історія України від Київської Русі до сучасності, ключові події та постаті",
                "faculty": "Факультет гуманітарних наук",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Історія та археологія"],
            },
            {
                "title": "Загальна соціологія",
                "description": "Вступ до соціології, основні соціологічні теорії, соціальні структури",
                "faculty": "Факультет соціальних наук і соціальних технологій",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Соціологія"],
            },
        ]

        courses = []
        for course_data in courses_data:
            department = Department.objects.filter(
                faculty=faculties[course_data["faculty"]]
            ).first()
            course = Course.objects.create(
                title=course_data["title"],
                description=course_data["description"],
                status=course_data["status"],
                department=department,
            )

            for speciality_name in course_data["specialities"]:
                if speciality_name in specialities:
                    course.specialities.add(specialities[speciality_name])

            courses.append(course)

        logger.info("courses_created", count=len(courses))

        course_offerings = []
        code_counter = 340000

        for course in courses:
            for _ in range(random.randint(2, 3)):
                semester = random.choice(semesters)
                code = f"{code_counter:06d}"
                code_counter += 1

                offering = CourseOffering.objects.create(
                    code=code,
                    course=course,
                    semester=semester,
                    credits=random.choice([3.0, 4.0, 5.0, 6.0]),
                    weekly_hours=random.randint(2, 6),
                    lecture_count=random.randint(15, 30),
                    practice_count=random.randint(10, 25),
                    practice_type=random.choice([PracticeType.PRACTICE, PracticeType.SEMINAR]),
                    exam_type=random.choice([ExamType.EXAM, ExamType.CREDIT]),
                    max_students=random.randint(25, 120),
                    max_groups=random.randint(2, 6),
                    group_size_min=random.randint(12, 18),
                    group_size_max=random.randint(18, 25),
                )

                selected_instructors = random.sample(instructors, random.randint(1, 3))
                for instructor in selected_instructors:
                    CourseInstructor.objects.create(
                        course_offering=offering,
                        instructor=instructor,
                        role=random.choice(["LECTURE_INSTRUCTOR", "PRACTICUM_INSTRUCTOR"]),
                    )

                course_offerings.append(offering)

        logger.info("course_offerings_created", count=len(course_offerings))

        logger.info(
            "base_data_generation_complete",
            faculties=len(faculties),
            specialities=len(specialities),
            instructors=len(instructors),
            students=len(students),
            courses=len(courses),
            course_offerings=len(course_offerings),
        )

        self.stdout.write(
            self.style.SUCCESS(
                "\nBase data for NaUKMA successfully set up!\n"
                f"Faculties: {len(faculties)}\n"
                f"Specialities: {len(specialities)}\n"
                f"Instructors: {len(instructors)}\n"
                f"Students: {len(students)}\n"
                f"Courses: {len(courses)}\n"
                f"Course offerings: {len(course_offerings)}"
            )
        )

        self.stdout.write("\nTo generate ratings, use:")
        self.stdout.write("  python manage.py generate_ratings")

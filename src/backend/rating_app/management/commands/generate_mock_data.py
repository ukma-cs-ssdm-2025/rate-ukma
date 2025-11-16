import random

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

import structlog

logger = structlog.get_logger(__name__)


class Command(BaseCommand):
    help = "Generate realistic NaUKMA mock data for the rate-ukma database"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help=(
                "Clear existing data before generating new data "
                "(LOCAL DEVELOPMENT ONLY – deletes all mock-related data)"
            ),
        )
        parser.add_argument(
            "--clean-only",
            action="store_true",
            help=(
                "Only clear existing data without generating new data "
                "(LOCAL DEVELOPMENT ONLY – deletes all mock-related data)"
            ),
        )

    def _confirm_clear(self) -> bool:
        self.stdout.write("")
        self.stdout.write(
            self.style.WARNING(
                "You are about to DELETE ALL mock-related data from the database.\n"
                "This is intended for LOCAL development only.\n"
            )
        )
        self.stdout.write(
            "Type 'yes' to continue, or anything else to abort: ",
        )
        try:
            answer = input()
        except EOFError:
            logger.warning("mock_data_clear_confirmation_failed", reason="no_input")
            self.stdout.write(self.style.ERROR("No input received. Aborting."))
            return False

        if answer.strip().lower() != "yes":
            logger.info("mock_data_clear_aborted", answer=answer.strip())
            self.stdout.write(self.style.ERROR("Aborted. No data was deleted."))
            return False

        logger.info("mock_data_clear_confirmed")
        return True

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

        if options["clear"] and options["clean_only"]:
            raise CommandError("Cannot use --clear and --clean-only options together.")

        if options["clean_only"]:
            if not self._confirm_clear():
                return

            logger.info("mock_data_clear_start")
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

            logger.info("mock_data_clear_complete")
            self.stdout.write(
                self.style.SUCCESS(
                    "\nAll mock data has been successfully cleared from the database."
                )
            )
            return

        if options["clear"]:
            if not self._confirm_clear():
                return

            logger.info("mock_data_clear_start")
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

        logger.info("mock_data_generation_start")

        # Create faculties and departments
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
                "name": "Гуманітарний факультет",
                "departments": [
                    "Кафедра історії",
                    "Кафедра філософії та релігієзнавства",
                    "Кафедра української мови та літератури",
                ],
            },
            {
                "name": "Соціологічний факультет",
                "departments": ["Кафедра соціології", "Кафедра психології", "Кафедра політології"],
            },
        ]

        faculties = {}
        for faculty_data in faculties_data:
            faculty = Faculty.objects.create(name=faculty_data["name"])
            faculties[faculty.name] = faculty

            for dept_name in faculty_data["departments"]:
                Department.objects.create(name=dept_name, faculty=faculty)

        logger.info("faculties_created", count=len(faculties))

        # Create specialities with assigned faculties
        specialities_data = [
            ("Комп'ютерні науки", "Факультет інформатики"),
            ("Прикладна математика", "Факультет інформатики"),
            ("Економіка", "Факультет економічних наук"),
            ("Фінанси, банківська справа та страхування", "Факультет економічних наук"),
            ("Право", "Факультет правничих наук"),
            ("Публічне управління та адміністрування", "Факультет правничих наук"),
            ("Історія та археологія", "Гуманітарний факультет"),
            ("Філософія", "Гуманітарний факультет"),
            ("Соціологія", "Соціологічний факультет"),
            ("Психологія", "Соціологічний факультет"),
            ("Політологія", "Соціологічний факультет"),
            ("Українська мова та література", "Гуманітарний факультет"),
        ]

        specialities = {}
        for spec_name, faculty_name in specialities_data:
            speciality = Speciality.objects.create(name=spec_name, faculty=faculties[faculty_name])
            specialities[spec_name] = speciality

        logger.info("specialities_created", count=len(specialities))

        # Create semesters
        semesters = []
        for year in range(2023, 2027):
            for term in [SemesterTerm.FALL, SemesterTerm.SPRING]:
                semester, created = Semester.objects.get_or_create(year=year, term=term)
                semesters.append(semester)

        # Add summer semesters for internships
        for year in range(2024, 2026):
            semester, created = Semester.objects.get_or_create(year=year, term=SemesterTerm.SUMMER)
            semesters.append(semester)

        logger.info("semesters_created", count=len(semesters))

        # Create instructors
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

        # Create students
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

        # Create realistic NaUKMA courses
        courses_data = [
            # Informatics Faculty courses
            {
                "title": "Аналіз великих даних (Big Data)",
                "description": "Вивчення методів та інструментів обробки великих обсягів даних, аналіз даних у реальному часі",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Логічне програмування",
                "description": "Основи логічного програмування, мови Prolog, декларативний підхід до розв'язання задач",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки", "Прикладна математика"],
            },
            {
                "title": "Машинне навчання",
                "description": "Алгоритми машинного навчання, нейронні мережі, глибинне навчання та їх практичне застосування",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки", "Прикладна математика"],
            },
            {
                "title": "Методи розробки програмних систем",
                "description": "Сучасні методології розробки ПЗ, Agile, Scrum, CI/CD, тестування програмних систем",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Основи штучного інтелекту",
                "description": "Вступ до штучного інтелекту, пошук знань, експертні системи, представлення знань",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Системний аналіз",
                "description": "Методологія системного аналізу, моделювання систем, прийняття рішень в умовах невизначеності",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Теорія ймовірностей та математична статистика",
                "description": "Основи теорії ймовірностей, математична статистика, статистичні методи аналізу даних",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Прикладна математика", "Комп'ютерні науки"],
            },
            {
                "title": "Функціональне програмування",
                "description": "Парадигми функціонального програмування, мови Haskell та Lisp, вища-порядкові функції",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки", "Прикладна математика"],
            },
            {
                "title": "Нейротехнології",
                "description": "Сучасні нейронні мережі, архітектури CNN, RNN, трансформери та їх застосування",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Соціальна інженерія",
                "description": "Психологічні аспекти кібербезпеки, методи соціальних атак, техніки захисту",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Технології сучасних дата-центрів",
                "description": "Архітектура дата-центрів, віртуалізація, хмарні технології, DevOps практики",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Глибинне навчання для задач комп'ютерного зору",
                "description": "CNN архітектури, обробка зображень, розпізнавання образів, computer vision",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Комп'ютерна бізнес-статистика",
                "description": "Статистичні методи в бізнес-аналізі, A/B тестування, прогнозування, регресійний аналіз",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Статистичні основи веб-аналітики",
                "description": "Аналіз веб-трафіку, поведінка користувачів, метрики ефективності, оптимізація конверсії",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Алгоритми та структури даних",
                "description": "Фундаментальні алгоритми сортування, пошуку, структури даних, аналіз складності",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки", "Прикладна математика"],
            },
            {
                "title": "Об'єктно-орієнтоване програмування",
                "description": "Принципи ООП, інкапсуляція, успадкування, поліморфізм, патерни проектування",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Веб-технології та розробка додатків",
                "description": "HTML5, CSS3, JavaScript, React, Angular, бекенд розробка, REST API",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Бази даних та системи управління",
                "description": "Реляційні та нереляційні БД, SQL, NoSQL, MongoDB, оптимізація запитів",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Комп'ютерні мережі та протоколи",
                "description": "TCP/IP, HTTP, DNS, мережева безпека, архітектура клієнт-сервер",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Операційні системи",
                "description": "Принципи роботи ОС, процеси, потоки, управління пам'яттю, файлові системи",
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
                "title": "Курсова робота (3 р.н.)",
                "description": "Самостійна робота з розробки програмного продукту під керівництвом викладача",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            {
                "title": "Практика виробнича",
                "description": "Виробнича практика в IT компаніях, набуття практичних навичок роботи в галузі",
                "faculty": "Факультет інформатики",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Комп'ютерні науки"],
            },
            # Economics Faculty courses
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
                "title": "Фінансовий менеджмент",
                "description": "Управління фінансами підприємств, інвестиційні рішення, оцінка вартості компанії",
                "faculty": "Факультет економічних наук",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Фінанси, банківська справа та страхування"],
            },
            {
                "title": "Корпоративні фінанси",
                "description": "Фінансове планування, структурування капіталу, дивідендна політика",
                "faculty": "Факультет економічних наук",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Фінанси, банківська справа та страхування"],
            },
            {
                "title": "Інвестиційний аналіз",
                "description": "Оцінка інвестиційних проектів, портфельна теорія, ризики та доходність",
                "faculty": "Факультет економічних наук",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Фінанси, банківська справа та страхування"],
            },
            {
                "title": "Грошово-кредитна політика",
                "description": "Монетарна політика, банківська система, фінансові ринки, регулювання",
                "faculty": "Факультет економічних наук",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Фінанси, банківська справа та страхування"],
            },
            {
                "title": "Економетрика",
                "description": "Статистичні методи аналізу економічних даних, регресійний аналіз, часові ряди",
                "faculty": "Факультет економічних наук",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Економіка", "Фінанси, банківська справа та страхування"],
            },
            # Law Faculty courses
            {
                "title": "Конституційне право України",
                "description": "Основи конституційного ладу, права та свободи людини, конституційний контроль",
                "faculty": "Факультет правничих наук",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Право", "Публічне управління та адміністрування"],
            },
            {
                "title": "Кримінальне право України",
                "description": "Загальна та особлива частини кримінального права, кримінальний процес",
                "faculty": "Факультет правничих наук",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Право"],
            },
            {
                "title": "Цивільне право України",
                "description": "Регулювання цивільно-правових відносин, зобов'язальне право, право власності",
                "faculty": "Факультет правничих наук",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Право"],
            },
            {
                "title": "Міжнародне публічне право",
                "description": "Основи міжнародного правопорядку, ООН, міжнародні договори, міжнародні організації",
                "faculty": "Факультет правничих наук",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Право", "Публічне управління та адміністрування"],
            },
            # Humanities Faculty courses
            {
                "title": "Історія України",
                "description": "Історія України від Київської Русі до сучасності, ключові події та постаті",
                "faculty": "Гуманітарний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Історія та археологія"],
            },
            {
                "title": "Історія світової цивілізації",
                "description": "Ключові етапи розвитку світових цивілізацій, порівняльна історія",
                "faculty": "Гуманітарний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Історія та археологія"],
            },
            {
                "title": "Філософія",
                "description": "Основи філософії, історія філософських течій, сучасні філософські проблеми",
                "faculty": "Гуманітарний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Філософія"],
            },
            {
                "title": "Логіка та критичне мислення",
                "description": "Формальна логіка, аргументація, критичний аналіз, прийняття рішень",
                "faculty": "Гуманітарний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Філософія"],
            },
            {
                "title": "Українська мова за професійним спрямуванням",
                "description": "Ділове українське мовлення, наукова термінологія, редагування текстів",
                "faculty": "Гуманітарний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Українська мова та література"],
            },
            {
                "title": "Історія української літератури",
                "description": "Розвиток української літератури від народження слов'янської писемності до сьогодення",
                "faculty": "Гуманітарний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Українська мова та література"],
            },
            # Sociology Faculty courses
            {
                "title": "Загальна соціологія",
                "description": "Вступ до соціології, основні соціологічні теорії, соціальні структури",
                "faculty": "Соціологічний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Соціологія"],
            },
            {
                "title": "Методологія соціологічних досліджень",
                "description": "Кількісні та якісні методи, вибірка, анкетування, інтерв'ю, аналіз даних",
                "faculty": "Соціологічний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Соціологія"],
            },
            {
                "title": "Соціологія сім'ї та демографія",
                "description": "Соціологічний аналіз сімейних відносин, демографічні процеси, тренді",
                "faculty": "Соціологічний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Соціологія"],
            },
            {
                "title": "Загальна психологія",
                "description": "Вступ до психології, основні психологічні теорії, структура особистості",
                "faculty": "Соціологічний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Психологія"],
            },
            {
                "title": "Соціальна психологія",
                "description": "Психологія соціальних взаємин, групова динаміка, соціальні установки",
                "faculty": "Соціологічний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Психологія", "Соціологія"],
            },
            {
                "title": "Політологія",
                "description": "Теорія політики, політичні системи, демократія, виборчі системи",
                "faculty": "Соціологічний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Політологія"],
            },
            {
                "title": "Соціальна структура та стратифікація",
                "description": "Соціальна нерівність, класова структура, мобільність, соціальні нерівності",
                "faculty": "Соціологічний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Соціологія"],
            },
            {
                "title": "Психологія особистості",
                "description": "Теорії особистості, структура особистості, розвиток особистості в онтогенезі",
                "faculty": "Соціологічний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Психологія"],
            },
            {
                "title": "Політична соціологія",
                "description": "Соціологічний аналіз політичних процесів, політична культура, громадянське суспільство",
                "faculty": "Соціологічний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Соціологія", "Політологія"],
            },
            {
                "title": "Порівняльна політологія",
                "description": "Порівняльний аналіз політичних систем різних країн, політичні режими",
                "faculty": "Соціологічний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Політологія"],
            },
            {
                "title": "Економічна соціологія",
                "description": "Соціологічний аналіз економічних явищ, ринків, економічної поведінки",
                "faculty": "Соціологічний факультет",
                "status": CourseStatus.ACTIVE,
                "specialities": ["Соціологія", "Економіка"],
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

        # Create course offerings
        course_offerings = []
        code_counter = 340000

        for course in courses:
            # Create 2-3 offerings per course with different semesters
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

                # Add 1-3 instructors to each offering
                selected_instructors = random.sample(instructors, random.randint(1, 3))
                for instructor in selected_instructors:
                    CourseInstructor.objects.create(
                        course_offering=offering,
                        instructor=instructor,
                        role=random.choice(["LECTURE_INSTRUCTOR", "PRACTICUM_INSTRUCTOR"]),
                    )

                course_offerings.append(offering)

        logger.info("course_offerings_created", count=len(course_offerings))

        # Create realistic ratings
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

        # Create ratings for about 70% of course offerings
        rated_offerings = random.sample(course_offerings, int(len(course_offerings) * 0.7))

        for offering in rated_offerings:
            # Create 3-12 ratings per offering
            num_ratings = random.randint(3, 12)
            selected_students = random.sample(students, min(num_ratings, len(students)))

            for student in selected_students:
                # Check if student hasn't already rated this offering
                if not Rating.objects.filter(student=student, course_offering=offering).exists():
                    # More realistic difficulty distribution (most courses moderately difficult)
                    difficulty = random.choices([1, 2, 3, 4, 5], weights=[5, 15, 35, 30, 15])[0]
                    # More positive usefulness ratings
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

        logger.info(
            "mock_data_generation_complete",
            faculties=len(faculties),
            specialities=len(specialities),
            instructors=len(instructors),
            students=len(students),
            courses=len(courses),
            course_offerings=len(course_offerings),
            ratings=len(ratings),
        )

        self.stdout.write(
            self.style.SUCCESS(
                "\nMock data for NaUKMA successfully generated!\n"
                f"Faculties: {len(faculties)}\n"
                f"Specialities: {len(specialities)}\n"
                f"Instructors: {len(instructors)}\n"
                f"Students: {len(students)}\n"
                f"Courses: {len(courses)}\n"
                f"Course offerings: {len(course_offerings)}\n"
                f"Ratings: {len(ratings)}"
            )
        )

        self.stdout.write("\nTo run the command use:")
        self.stdout.write("  python manage.py generate_mock_data")
        self.stdout.write("\nTo clear existing data and create new:")
        self.stdout.write("  python manage.py generate_mock_data --clear")
        self.stdout.write("\nTo only clear existing data without generating new:")
        self.stdout.write("  python manage.py generate_mock_data --clean-only")

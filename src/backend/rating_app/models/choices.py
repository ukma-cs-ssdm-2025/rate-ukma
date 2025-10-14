from django.db import models


class EducationLevel(models.TextChoices):
    BACHELOR = "BACHELOR", "Bachelor"
    MASTER = "MASTER", "Master"


class CourseStatus(models.TextChoices):
    PLANNED = "PLANNED", "Planned"
    ACTIVE = "ACTIVE", "Active"
    FINISHED = "FINISHED", "Finished"


class CourseTypeKind(models.TextChoices):
    COMPULSORY = "COMPULSORY", "Compulsory"
    ELECTIVE = "ELECTIVE", "Elective"


class SemesterTerm(models.TextChoices):
    FALL = "FALL", "Fall"
    SPRING = "SPRING", "Spring"
    SUMMER = "SUMMER", "Summer"


class ExamType(models.TextChoices):
    EXAM = "EXAM", "Exam"
    CREDIT = "CREDIT", "Credit"


class PracticeType(models.TextChoices):
    PRACTICE = "PRACTICE", "Practice"
    SEMINAR = "SEMINAR", "Seminar"


class EnrollmentStatus(models.TextChoices):
    ENROLLED = "ENROLLED", "Enrolled"
    DROPPED = "DROPPED", "Dropped"
    FORCED = "FORCED", "Forced"


class AcademicDegree(models.TextChoices):
    PHD = "PHD", "PhD"
    DOCTOR_OF_SCIENCES = "DRSCI", "DoctorOfSciences"


class AcademicTitle(models.TextChoices):
    ASSISTANT = "ASSISTANT", "Assistant"
    LECTURER = "LECTURER", "Lecturer"
    SENIOR_LECTURER = "SENIOR_LECTURER", "SeniorLecturer"
    ASSOCIATE_PROF = "ASSOCIATE_PROF", "AssociateProfessor"
    PROFESSOR = "PROFESSOR", "Professor"

import type { PlanCourse, PlanYear } from "./studyPlanTypes";

// Preview data. Past and current years mirror what will be pulled from SAZ;
// future years are prefilled with normative courses and the student's picks.

const FI = "Факультет інформатики";
const FEN = "Факультет економічних наук";
const FGN = "Факультет гуманітарних наук";
const FSNST = "Факультет соціальних наук та соціальних технологій";

let sequence = 0;

function compulsory(title: string, credits: number): PlanCourse {
	sequence += 1;
	return {
		id: `plan-${sequence}`,
		title,
		credits,
		category: "COMPULSORY",
		facultyName: FI,
	};
}

function pick(
	title: string,
	credits: number,
	category: "PROF_ORIENTED" | "ELECTIVE",
	facultyName = FI,
	difficulty?: number,
	usefulness?: number,
): PlanCourse {
	sequence += 1;
	return {
		id: `plan-${sequence}`,
		title,
		credits,
		category,
		facultyName,
		difficulty,
		usefulness,
	};
}

export const MOCK_STUDENT = {
	program: "Інженерія програмного забезпечення",
	level: "Бакалаврат",
	courseNumber: 2,
};

export const MOCK_STUDY_PLAN: PlanYear[] = [
	{
		key: "year-1",
		courseNumber: 1,
		academicYear: "2025–2026",
		status: "completed",
		semesters: [
			{
				key: "year-1-fall",
				season: "FALL",
				courses: [
					compulsory("Математичний аналіз", 7),
					compulsory("Основи програмування", 6),
					compulsory("Дискретна математика", 5),
					compulsory("Алгебра і геометрія", 5),
					compulsory("Вступ до програмної інженерії", 3),
					pick("Академічне письмо", 4, "ELECTIVE", FGN),
				],
				backups: [],
			},
			{
				key: "year-1-spring",
				season: "SPRING",
				courses: [
					compulsory("Об'єктно-орієнтоване програмування", 6),
					compulsory("Теорія ймовірностей", 5),
					compulsory("Архітектура комп'ютера", 5),
					compulsory("Англійська мова", 4),
					compulsory("Історія України", 4),
					pick("Вступ до філософії", 3, "ELECTIVE", FGN),
				],
				backups: [],
			},
			{
				key: "year-1-summer",
				season: "SUMMER",
				courses: [compulsory("Навчальна практика", 3)],
				backups: [],
			},
		],
	},
	{
		key: "year-2",
		courseNumber: 2,
		academicYear: "2026–2027",
		status: "current",
		semesters: [
			{
				key: "year-2-fall",
				season: "FALL",
				courses: [
					compulsory("Алгоритми і структури даних", 6),
					compulsory("Бази даних", 5),
					compulsory("Операційні системи", 5),
					compulsory("Вимоги до програмного забезпечення", 4),
					compulsory("Англійська мова професійного спрямування", 3),
					pick("Веб-технології", 5, "PROF_ORIENTED"),
					pick("Психологія спілкування", 3, "ELECTIVE", FSNST),
				],
				backups: [],
			},
			{
				key: "year-2-spring",
				season: "SPRING",
				courses: [
					compulsory("Архітектура програмного забезпечення", 5),
					compulsory("Комп'ютерні мережі", 5),
					compulsory("Тестування програмного забезпечення", 4),
					compulsory("Курсова робота", 3),
					pick("Мобільна розробка", 5, "PROF_ORIENTED"),
					pick("Функціональне програмування", 4, "PROF_ORIENTED"),
					pick("Економіка для ІТ", 3, "ELECTIVE", FEN),
				],
				backups: [],
			},
			{ key: "year-2-summer", season: "SUMMER", courses: [], backups: [] },
		],
	},
	{
		key: "year-3",
		courseNumber: 3,
		academicYear: "2027–2028",
		status: "planned",
		semesters: [
			{
				key: "year-3-fall",
				season: "FALL",
				courses: [
					compulsory("Проєктування програмних систем", 5),
					compulsory("Менеджмент ІТ-проєктів", 4),
					compulsory("Безпека програмного забезпечення", 4),
					pick("Машинне навчання", 5, "PROF_ORIENTED", FI, 4.1, 4.6),
					pick("DevOps-практики", 5, "PROF_ORIENTED", FI, 3.4, 4.4),
					pick("Цифрові медіа", 3, "ELECTIVE", FSNST, 2.1, 3.5),
				],
				backups: [
					pick("Хмарні обчислення", 5, "PROF_ORIENTED", FI, 3.2, 4.3),
					pick("Комп'ютерна графіка", 5, "PROF_ORIENTED", FI, 3.9, 3.8),
				],
			},
			{
				key: "year-3-spring",
				season: "SPRING",
				courses: [
					compulsory("Якість програмного забезпечення", 4),
					compulsory("Людино-машинна взаємодія", 4),
					compulsory("Курсова робота", 3),
					pick("Розподілені системи", 5, "PROF_ORIENTED", FI, 4.3, 4.5),
					pick("Обробка природної мови", 5, "PROF_ORIENTED", FI, 4.0, 4.2),
				],
				backups: [pick("Креативне письмо", 3, "ELECTIVE", FGN, 2.0, 3.9)],
			},
			{
				key: "year-3-summer",
				season: "SUMMER",
				courses: [compulsory("Виробнича практика", 6)],
				backups: [],
			},
		],
	},
	{
		key: "year-4",
		courseNumber: 4,
		academicYear: "2028–2029",
		status: "planned",
		semesters: [
			{
				key: "year-4-fall",
				season: "FALL",
				courses: [
					compulsory("Супровід програмного забезпечення", 4),
					compulsory("Етика в ІТ", 3),
				],
				backups: [],
			},
			{
				key: "year-4-spring",
				season: "SPRING",
				courses: [
					compulsory("Бакалаврська кваліфікаційна робота", 10),
					compulsory("Переддипломна практика", 6),
				],
				backups: [],
			},
			{
				key: "year-4-summer",
				season: "SUMMER",
				courses: [],
				backups: [],
				isUnavailable: true,
			},
		],
	},
];

/** Courses available on Rate UKMA that a student may add to a future year. */
export const MOCK_COURSE_CATALOG: PlanCourse[] = [
	pick("Хмарні обчислення", 5, "PROF_ORIENTED", FI, 3.2, 4.3),
	pick("Комп'ютерна графіка", 5, "PROF_ORIENTED", FI, 3.9, 3.8),
	pick("Компілятори", 5, "PROF_ORIENTED", FI, 4.6, 3.9),
	pick("Аналіз даних", 4, "PROF_ORIENTED", FI, 3.5, 4.5),
	pick("Кібербезпека", 5, "PROF_ORIENTED", FI, 3.8, 4.2),
	pick("Розробка ігор", 4, "PROF_ORIENTED", FI, 3.3, 3.7),
	pick("Блокчейн-технології", 4, "PROF_ORIENTED", FI, 3.6, 3.4),
	pick("Системи реального часу", 5, "PROF_ORIENTED", FI, 4.2, 3.6),
	pick("Креативне письмо", 3, "ELECTIVE", FGN, 2.0, 3.9),
	pick("Основи підприємництва", 3, "ELECTIVE", FEN, 2.4, 4.1),
	pick("Історія мистецтва", 3, "ELECTIVE", FGN, 1.9, 3.6),
	pick("Політична філософія", 4, "ELECTIVE", FGN, 3.1, 3.8),
	pick("Поведінкова економіка", 3, "ELECTIVE", FEN, 2.8, 4.3),
	pick("Медіаграмотність", 3, "ELECTIVE", FSNST, 1.7, 3.9),
];

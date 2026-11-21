import type {
	CourseTypeKindEnum,
	EducationLevelEnum,
	ExamTypeEnum,
} from "@/lib/api/generated";

export const DIFFICULTY_RANGE: [number, number] = [1, 5];
export const USEFULNESS_RANGE: [number, number] = [1, 5];
export const CREDITS_RANGE: [number, number] = [0.5, 20];

export function formatDecimalValue(
	value: number | null | undefined,
	{
		fallback = "—",
		precision = 1,
	}: { fallback?: string; precision?: number } = {},
): string {
	if (value == null) {
		return fallback;
	}

	return Number(value.toFixed(precision)).toString();
}

const EDUCATION_LEVEL_LABELS = {
	BACHELOR: "Бакалавр",
	MASTER: "Магістр",
} satisfies Record<EducationLevelEnum, string>;

export function getEducationLevelDisplay(level: EducationLevelEnum): string {
	return EDUCATION_LEVEL_LABELS[level];
}

const COURSE_TYPE_LABELS = {
	COMPULSORY: "Обов'язковий",
	ELECTIVE: "Вибірковий",
	PROF_ORIENTED: "Професійно-орієнтований",
} satisfies Record<CourseTypeKindEnum, string>;

export function getCourseTypeDisplay(value: CourseTypeKindEnum): string {
	return COURSE_TYPE_LABELS[value];
}

const EXAM_TYPE_LABELS = {
	EXAM: "Іспит",
	CREDIT: "Залік",
} satisfies Record<ExamTypeEnum, string>;

export function getExamTypeDisplay(value: ExamTypeEnum): string {
	return EXAM_TYPE_LABELS[value];
}

export function formatDate(dateString: string): string {
	const date = new Date(dateString);
	if (Number.isNaN(date.getTime())) {
		return "—";
	}
	return new Intl.DateTimeFormat("uk-UA", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(date);
}

export function formatCredits(credits?: string | null): string | null {
	if (!credits) {
		return null;
	}
	const parsed = Number.parseFloat(credits);
	if (!Number.isFinite(parsed)) {
		return `${credits} ECTS`;
	}
	return `${Number.isInteger(parsed) ? parsed.toFixed(0) : parsed.toFixed(1)} ECTS`;
}

export function formatWeeklyHours(hours?: number | null): string | null {
	if (hours == null) {
		return null;
	}
	return `${hours} год`;
}

export function getAcademicStartYear(
	year?: number | null,
	term?: string | null,
): number | null {
	if (year == null || !term) {
		return null;
	}
	const normalized = term.toUpperCase();
	if (normalized === "FALL") {
		return year;
	}
	if (normalized === "SPRING" || normalized === "SUMMER") {
		return year - 1;
	}
	return null;
}

export function formatAcademicYearLabel(
	year?: number | null,
	term?: string | null,
): string {
	const startYear = getAcademicStartYear(year, term);
	if (startYear == null) {
		return "—";
	}
	return `${startYear}–${startYear + 1}`;
}

export function hasCourseScores(
	difficulty?: number | null,
	usefulness?: number | null,
	ratingsCount?: number | null,
): boolean {
	if ((ratingsCount ?? 0) > 0) {
		return true;
	}
	const difficultyInRange =
		difficulty != null &&
		difficulty >= DIFFICULTY_RANGE[0] &&
		difficulty <= DIFFICULTY_RANGE[1];
	const usefulnessInRange =
		usefulness != null &&
		usefulness >= USEFULNESS_RANGE[0] &&
		usefulness <= USEFULNESS_RANGE[1];
	return difficultyInRange || usefulnessInRange;
}

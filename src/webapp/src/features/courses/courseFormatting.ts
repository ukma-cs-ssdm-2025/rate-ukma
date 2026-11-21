import type {
	CourseTypeKindEnum,
	EducationLevelEnum,
	ExamTypeEnum,
	SemesterTermEnum,
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

export function getDifficultyTone(value?: number | null): string {
	if (!value) {
		return "text-muted-foreground";
	}

	if (value >= 4) {
		return "text-destructive";
	}

	if (value >= 3) {
		return "text-chart-5";
	}

	return "text-primary";
}

export function getUsefulnessTone(value?: number | null): string {
	if (!value) {
		return "text-muted-foreground";
	}

	if (value >= 4) {
		return "text-primary";
	}

	if (value >= 3) {
		return "text-chart-2";
	}

	return "text-muted-foreground";
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

const SEMESTER_TERM_LABELS = {
	FALL: "Осінь",
	SPRING: "Весна",
	SUMMER: "Літо",
} satisfies Record<SemesterTermEnum, string>;

function isSemesterTerm(value: string): value is SemesterTermEnum {
	return Object.hasOwn(SEMESTER_TERM_LABELS, value);
}

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

/**
 * Course offerings send the term's label ("Spring") while every other
 * endpoint sends the value ("SPRING"); read both as the enum.
 */
export function parseSemesterTerm(
	value: string | null | undefined,
): SemesterTermEnum | null {
	const upper = value?.toUpperCase();
	return upper !== undefined && isSemesterTerm(upper) ? upper : null;
}

export function getSemesterTermDisplay(
	term: string,
	fallback?: string,
): string {
	const parsed = parseSemesterTerm(term);
	return parsed === null ? (fallback ?? term) : SEMESTER_TERM_LABELS[parsed];
}

export function getSemesterDisplay(
	year: number,
	term: string,
	fallback?: string,
): string {
	return `${getSemesterTermDisplay(term, fallback)} ${year}`;
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
	}).format(date); // e.g. "26 жовтня 2025"
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

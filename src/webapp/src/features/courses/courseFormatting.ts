export const DIFFICULTY_RANGE: [number, number] = [1, 5];
export const USEFULNESS_RANGE: [number, number] = [1, 5];

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

export function getFacultyAbbreviation(facultyName: string): string {
	const words = facultyName.trim().split(/\s+/);
	return words.map((word) => word.charAt(0).toUpperCase()).join("");
}

export function getDifficultyTone(value?: number | null): string {
	if (!value) {
		return "text-muted-foreground";
	}

	if (value >= 4) {
		return "text-[var(--destructive)] dark:text-[var(--destructive-foreground)]";
	}

	if (value >= 3) {
		return "text-[var(--chart-5)] dark:text-[var(--chart-5)]";
	}

	return "text-[var(--primary)]";
}

export function getUsefulnessTone(value?: number | null): string {
	if (!value) {
		return "text-muted-foreground";
	}

	if (value >= 4) {
		return "text-[var(--primary)]";
	}

	if (value >= 3) {
		return "text-[var(--chart-2)] dark:text-[var(--chart-2)]";
	}

	return "text-[var(--muted-foreground)]";
}

const COURSE_TYPE_LABELS: Record<string, string> = {
	COMPULSORY: "Обов'язковий",
	ELECTIVE: "Вибірковий",
	PROF_ORIENTED: "Професійно орієнтований",
};

const SEMESTER_TERM_LABELS: Record<string, string> = {
	FALL: "Осінь",
	SPRING: "Весна",
	SUMMER: "Літо",
};

export function getCourseTypeDisplay(value: string, fallback?: string): string {
	return COURSE_TYPE_LABELS[value] ?? fallback ?? value;
}

export function getSemesterTermDisplay(
	term: string,
	fallback?: string,
): string {
	return SEMESTER_TERM_LABELS[term.toUpperCase()] ?? fallback ?? term;
}

export function getSemesterDisplay(
	year: number,
	term: string,
	fallback?: string,
): string {
	return `${year} ${getSemesterTermDisplay(term, fallback)}`;
}

export function getStatusLabel(status: string): string {
	const STATUS_LABELS: Record<string, string> = {
		PLANNED: "Заплановано",
		ACTIVE: "Активний",
		FINISHED: "Завершено",
	};
	return STATUS_LABELS[status] ?? status;
}

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function getStatusVariant(status: string): BadgeVariant {
	const STATUS_VARIANTS: Record<string, BadgeVariant> = {
		PLANNED: "outline",
		ACTIVE: "default",
		FINISHED: "secondary",
	};
	return STATUS_VARIANTS[status] ?? "default";
}

export function getTypeKindLabel(typeKind: string): string {
	return COURSE_TYPE_LABELS[typeKind] ?? typeKind;
}

export function getTypeKindVariant(typeKind: string): BadgeVariant {
	const TYPE_KIND_VARIANTS: Record<string, BadgeVariant> = {
		COMPULSORY: "default",
		ELECTIVE: "secondary",
		PROF_ORIENTED: "outline",
	};
	return TYPE_KIND_VARIANTS[typeKind] ?? "outline";
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

export type SemesterSeason = "FALL" | "SPRING" | "SUMMER";

interface CurrentSemester {
	year: number;
	season: SemesterSeason;
}

const MONTH_TO_SEASON: Record<number, SemesterSeason> = {
	1: "SPRING",
	2: "SPRING",
	3: "SPRING",
	4: "SPRING",
	5: "SUMMER",
	6: "SUMMER",
	7: "SUMMER",
	8: "SUMMER",
	9: "FALL",
	10: "FALL",
	11: "FALL",
	12: "FALL",
};

const CALENDAR_SEASON_ORDER: Record<string, number> = {
	SPRING: 0,
	SUMMER: 1,
	FALL: 2,
};

export function getCurrentSemester(now: Date = new Date()): CurrentSemester {
	const month = now.getMonth() + 1;
	const year = now.getFullYear();
	return { year, season: MONTH_TO_SEASON[month] };
}

export function compareSemesters(
	a: { year: number; season: string },
	b: { year: number; season: string },
): number {
	const valueA =
		a.year * 10 + (CALENDAR_SEASON_ORDER[a.season.toUpperCase()] ?? 5);
	const valueB =
		b.year * 10 + (CALENDAR_SEASON_ORDER[b.season.toUpperCase()] ?? 5);
	return valueA - valueB;
}

export function isFutureSemester(
	semester: { year: number; season: string },
	current: CurrentSemester = getCurrentSemester(),
): boolean {
	return compareSemesters(semester, current) > 0;
}

export function isCurrentSemester(
	semester: { year: number; season: string },
	current: CurrentSemester = getCurrentSemester(),
): boolean {
	return (
		semester.year === current.year &&
		semester.season.toUpperCase() === current.season
	);
}

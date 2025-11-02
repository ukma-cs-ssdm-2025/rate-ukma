export const DIFFICULTY_RANGE: [number, number] = [1, 5];
export const USEFULNESS_RANGE: [number, number] = [1, 5];

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

	return "text-[var(--primary)] dark:text-[var(--primary-foreground)]";
}

export function getUsefulnessTone(value?: number | null): string {
	if (!value) {
		return "text-muted-foreground";
	}

	if (value >= 4) {
		return "text-[var(--primary)] dark:text-[var(--primary-foreground)]";
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
	return new Intl.DateTimeFormat("uk-UA", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(date); // e.g. "26 жовтня 2025"
}

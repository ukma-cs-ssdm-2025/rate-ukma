const DIFFICULTY_DEFAULT_RANGE: [number, number] = [1, 5];
const USEFULNESS_DEFAULT_RANGE: [number, number] = [1, 5];

export function getFacultyAbbreviation(facultyName: string): string {
	const words = facultyName.trim().split(/\s+/);
	return words.map((word) => word.charAt(0).toUpperCase()).join("");
}

export function getDifficultyTone(value?: number): string {
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

export function getUsefulnessTone(value?: number): string {
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

export const DIFFICULTY_RANGE = DIFFICULTY_DEFAULT_RANGE;
export const USEFULNESS_RANGE = USEFULNESS_DEFAULT_RANGE;

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

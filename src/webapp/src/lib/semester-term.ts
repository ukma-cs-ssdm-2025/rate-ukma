import type { SemesterTermEnum } from "@/lib/api/generated";

const SEMESTER_TERM_LABELS = {
	FALL: "Осінь",
	SPRING: "Весна",
	SUMMER: "Літо",
} satisfies Record<SemesterTermEnum, string>;

function isSemesterTerm(value: string): value is SemesterTermEnum {
	return Object.hasOwn(SEMESTER_TERM_LABELS, value);
}

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

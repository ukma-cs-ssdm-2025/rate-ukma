const YEARS_BACK = 10;

export function academicYears(now: Date = new Date()): number[] {
	const current =
		now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
	return Array.from({ length: YEARS_BACK }, (_, index) => current + 1 - index);
}

export const yearLabel = (year: number): string => `${year}–${year + 1} н. р.`;

export interface ListFilter {
	field: string | null;
	query: string;
	year: number | null;
}

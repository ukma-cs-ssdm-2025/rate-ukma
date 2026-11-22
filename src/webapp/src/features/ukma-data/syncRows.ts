import type { SyncChange } from "@/lib/api/generated";
import { numberAt, readPath } from "./sync";
import { changePair, valueText } from "./syncFields";
import { cleanTitle, semesterLabel } from "./syncWords";

export interface TableRow {
	id: number;
	title: string;
	department: string;
	semester: string;
	studyYear: string;
	sazCode: string;
	change: string;
}

function textAt(raw: unknown, ...path: string[]): string {
	const value = readPath(raw, ...path);
	if (typeof value === "string") {
		return value;
	}
	return typeof value === "number" ? String(value) : "";
}

function firstText(
	raw: unknown,
	paths: readonly (readonly string[])[],
): string {
	for (const path of paths) {
		const value = textAt(raw, ...path);
		if (value !== "") {
			return value;
		}
	}
	return "";
}

function codes(raw: unknown): string {
	const value = readPath(raw, "display", "course", "saz_codes");
	if (!Array.isArray(value)) {
		return "";
	}
	const found = value.filter((code) => typeof code === "string");
	const shown = found.slice(0, 2).join(", ");
	return found.length > 2 ? `${shown} і ще ${found.length - 2}` : shown;
}

function semesterOf(after: unknown): string {
	const year = numberAt(after, "semester", "year");
	const term = textAt(after, "semester", "term");
	return year === null ? "" : semesterLabel(year, term);
}

export function tableRow(change: SyncChange, field: string | null): TableRow {
	const { after, before } = change;
	const studyYear = numberAt(after, "study_year");
	const pair = field === null ? null : changePair(field, after, before);
	return {
		id: change.id,
		title: cleanTitle(
			firstText(after, [
				["display", "course", "title"],
				["display", "ukma_course", "title"],
				["title"],
				["display", "name"],
				["name"],
			]),
		),
		department: cleanTitle(
			firstText(after, [
				["display", "course", "department"],
				["display", "ukma_course", "department"],
			]),
		),
		semester: semesterOf(after) || semesterOf(before),
		studyYear: studyYear === null ? "" : `${studyYear}-й рік`,
		sazCode: textAt(after, "saz_code") || codes(after),
		change:
			pair === null || field === null
				? ""
				: `${valueText(field, pair.before)} → ${valueText(field, pair.after)}`,
	};
}

export const YEAR_RANGES = ["all", "current", "earlier"] as const;

export type YearRange = (typeof YEAR_RANGES)[number];

export function academicYear(now: Date = new Date()): number {
	return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

export function yearRangeLabel(
	range: YearRange,
	now: Date = new Date(),
): string {
	const year = academicYear(now);
	if (range === "current") {
		return `${year}–${year + 1}`;
	}
	return range === "earlier" ? "Раніші" : "Усі роки";
}

export interface YearBounds {
	year_from?: number;
	year_to?: number;
}

export function yearFilter(
	range: YearRange,
	now: Date = new Date(),
): YearBounds {
	const year = academicYear(now);
	if (range === "current") {
		return { year_from: year, year_to: year };
	}
	return range === "earlier" ? { year_to: year - 1 } : {};
}

export interface PageSlice<T> {
	items: T[];
	page: number;
	totalPages: number;
	from: number;
	to: number;
}

export function pageSlice<T>(
	items: readonly T[],
	page: number,
	size: number,
): PageSlice<T> {
	const totalPages = Math.max(1, Math.ceil(items.length / size));
	const current = Math.min(Math.max(1, page), totalPages);
	const start = (current - 1) * size;
	const slice = items.slice(start, start + size);
	return {
		items: slice,
		page: current,
		totalPages,
		from: slice.length === 0 ? 0 : start + 1,
		to: start + slice.length,
	};
}

export function pageNumbers(page: number, total: number): (number | null)[] {
	if (total <= 5) {
		return Array.from({ length: total }, (_, index) => index + 1);
	}
	const shown = new Set([1, page - 1, page, page + 1, total]);
	const pages = [...shown]
		.filter((value) => value >= 1 && value <= total)
		.sort((left, right) => left - right);
	return pages.flatMap((value, index) => {
		const previous = pages[index - 1];
		return previous !== undefined && value - previous > 1
			? [null, value]
			: [value];
	});
}

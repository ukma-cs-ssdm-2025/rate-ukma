import type { SyncChange, SyncPendingResponse } from "@/lib/api/generated";
import { countWith } from "./syncFormat";

export interface ReviewEntry {
	change: SyncChange;
	nested: SyncChange[];
}

export const FIELD_CHIPS = 5;

const courseKey = (change: SyncChange): string =>
	`${change.view.title} — ${change.view.place ?? ""}`;

export function nestLinks(items: readonly SyncChange[]): ReviewEntry[] {
	const courses = new Map<string, ReviewEntry>();
	for (const change of items) {
		if (change.kind === "link_course" && !courses.has(courseKey(change))) {
			courses.set(courseKey(change), { change, nested: [] });
		}
	}
	return items.flatMap((change) => {
		if (change.kind === "link_course") {
			const entry = courses.get(courseKey(change));
			return entry?.change === change ? [entry] : [{ change, nested: [] }];
		}
		const parent =
			change.kind === "link_offering"
				? courses.get(courseKey(change))
				: undefined;
		if (parent === undefined) {
			return [{ change, nested: [] }];
		}
		parent.nested.push(change);
		return [];
	});
}

export const entryIds = (entry: ReviewEntry): number[] => [
	entry.change.id,
	...entry.nested.map((child) => child.id),
];

export function visibleFields(
	fields: SyncPendingResponse["changed_fields"],
	selected: string | null,
	expanded: boolean,
): [string, number][] {
	const sorted = Object.entries(fields).sort((a, b) => b[1] - a[1]);
	if (expanded) {
		return sorted;
	}
	const top = sorted.slice(0, FIELD_CHIPS);
	const chosen = sorted.find(([name]) => name === selected);
	return chosen === undefined || top.includes(chosen) ? top : [...top, chosen];
}

const SEMESTER_FORMS = { one: "семестр", few: "семестри", many: "семестрів" };

export function nestedText(nested: readonly SyncChange[]): string {
	const known = nested.flatMap((child) =>
		child.view.semester ? [child.view.semester] : [],
	);
	const unknown = nested.length - known.length;
	const parts =
		unknown === 0
			? known
			: [...known, `ще ${countWith(unknown, SEMESTER_FORMS)}`];
	return `І семестри: ${parts.join(", ")}`;
}

const YEARS_BACK = 10;

export function academicYears(now: Date = new Date()): number[] {
	const current =
		now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
	return Array.from({ length: YEARS_BACK }, (_, index) => current + 1 - index);
}

export const yearLabel = (year: number): string => `${year}–${year + 1}`;

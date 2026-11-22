import type { SyncFieldRow } from "@/lib/api/generated";
import { readPath } from "./sync";
import { TERM_LABELS } from "./syncWords";

const LABELS: ReadonlyMap<string, string> = new Map([
	["practice_type", "Тип практичних занять"],
	["practice_count", "Кількість практичних"],
	["credits", "Кредити"],
	["lecture_count", "Кількість лекцій"],
	["weekly_hours", "Годин на тиждень"],
	["exam_type", "Форма контролю"],
	["term", "Семестр"],
	["year", "Рік"],
	["study_year", "Рік навчання"],
	["max_students", "Найбільше студентів"],
	["max_groups", "Кількість груп"],
	["group_size_min", "Найменша група"],
	["group_size_max", "Найбільша група"],
	["specialities", "Спеціальності"],
	["title", "Назва"],
	["name", "Назва"],
	["department", "Кафедра"],
	["faculty", "Факультет"],
	["status", "Статус"],
	["description", "Опис"],
	["education_level", "Рівень освіти"],
	["other", "Інші дані"],
]);

const BLANKED: ReadonlyMap<string, string> = new Map([
	["practice_type", "тип практичних"],
	["practice_count", "кількість практичних"],
	["credits", "кредити"],
	["lecture_count", "кількість лекцій"],
	["weekly_hours", "години на тиждень"],
	["exam_type", "форму контролю"],
	["description", "опис"],
]);

const VALUES: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map([
	[
		"practice_type",
		new Map([
			["PRACTICE", "практика"],
			["SEMINAR", "семінар"],
			["LAB", "лабораторні"],
		]),
	],
	[
		"exam_type",
		new Map([
			["CREDIT", "залік"],
			["EXAM", "екзамен"],
		]),
	],
	["term", TERM_LABELS],
]);

export const MOVING_FIELDS: ReadonlySet<string> = new Set(["term", "year"]);

export const fieldLabel = (field: string): string => LABELS.get(field) ?? field;

export function blankTitle(field: string): string {
	const what =
		BLANKED.get(field) ?? `поле «${fieldLabel(field).toLowerCase()}»`;
	return `САЗ більше не вказує ${what}`;
}

export function valueText(field: string, value: string): string {
	if (value === "" || value === "None") {
		return "не вказано";
	}
	if (field === "credits") {
		return value.replace(".", ",");
	}
	if (field === "specialities") {
		return `+${value}`;
	}
	return VALUES.get(field)?.get(value) ?? value;
}

export interface ValuePair {
	before: string;
	after: string;
}

const TERM_FIELDS: ReadonlySet<string> = new Set([
	"practice_type",
	"practice_count",
	"credits",
	"lecture_count",
	"weekly_hours",
	"exam_type",
]);

function text(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}
	if (typeof value === "string" || typeof value === "number") {
		return String(value);
	}
	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}
	const name = readPath(value, "name");
	return typeof name === "string" ? name : "";
}

function list(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

const termKey = (term: unknown): string =>
	`${text(readPath(term, "year"))}:${text(readPath(term, "term"))}`;

export function changePair(
	field: string,
	after: unknown,
	before: unknown,
): ValuePair | null {
	if (TERM_FIELDS.has(field)) {
		const old = new Map(
			list(readPath(before, "terms")).map((term) => [termKey(term), term]),
		);
		for (const term of list(readPath(after, "terms"))) {
			const previous = old.get(termKey(term));
			if (previous === undefined) {
				continue;
			}
			const next = text(readPath(term, field));
			const was = text(readPath(previous, field));
			if (next !== was) {
				return { before: was, after: next };
			}
		}
	}
	if (MOVING_FIELDS.has(field)) {
		const next = text(readPath(after, "semester", field));
		const was = text(readPath(before, "semester", field));
		return next === was ? null : { before: was, after: next };
	}
	const next = text(readPath(after, field));
	const was = text(readPath(before, field));
	return next === was ? null : { before: was, after: next };
}

export interface FieldLine {
	row: SyncFieldRow;
	blanking: boolean;
}

export function fieldLines(
	byField: readonly SyncFieldRow[],
	blanking: readonly SyncFieldRow[],
): FieldLine[] {
	const placed = new Set<string>();
	const lines = byField.flatMap((row) => {
		const blank = blanking.find((item) => item.field === row.field);
		if (blank === undefined) {
			return [{ row, blanking: false }];
		}
		placed.add(blank.field);
		return [
			{ row, blanking: false },
			{ row: blank, blanking: true },
		];
	});
	const rest = blanking.flatMap((row) =>
		placed.has(row.field) ? [] : [{ row, blanking: true }],
	);
	return [...lines, ...rest];
}

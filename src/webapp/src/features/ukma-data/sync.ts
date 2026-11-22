import {
	SyncChangeGroupEnum,
	SyncChangeStateEnum,
	SyncSourceEnum,
} from "@/lib/api/generated";
import type {
	SyncChange,
	SyncChangeGroupEnum as Group,
	SyncChangeStateEnum as State,
	SyncRunStatusEnum as RunStatus,
} from "@/lib/api/generated";
import {
	FIELD_LABELS,
	GROUP_LABELS,
	KIND_LABELS,
	STATE_LABELS,
} from "./syncLabels";
import type { SyncKind } from "./syncLabels";

export const SYNC_SOURCES = Object.values(SyncSourceEnum);
export const SYNC_GROUPS = Object.values(SyncChangeGroupEnum);
export const SYNC_STATES = Object.values(SyncChangeStateEnum);
export const ALL = "all";

export const isSyncKind = (kind: string): kind is SyncKind =>
	kind in KIND_LABELS;

const isState = (state: string): state is State => state in STATE_LABELS;

const isGroup = (group: string): group is Group => group in GROUP_LABELS;

export const kindLabel = (kind: string): string =>
	isSyncKind(kind) ? KIND_LABELS[kind] : fieldLabel(kind);

export const fieldLabel = (key: string): string => FIELD_LABELS.get(key) ?? key;

export const stateLabel = (state: string): string =>
	isState(state) ? STATE_LABELS[state] : state;

const UK_PLURALS = new Intl.PluralRules("uk");
const RATING_FORMS: Record<Intl.LDMLPluralRule, string> = {
	zero: "оцінок",
	one: "оцінка",
	two: "оцінки",
	few: "оцінки",
	many: "оцінок",
	other: "оцінки",
};

export const ratingLabel = (count: number): string =>
	`${count} ${RATING_FORMS[UK_PLURALS.select(count)]}`;

export function formatAge(seconds: number): string {
	const days = Math.floor(seconds / 86_400);
	if (days >= 1) {
		return `${days} дн`;
	}
	const hours = Math.floor(seconds / 3600);
	return hours >= 1 ? `${hours} год` : "менше години";
}

export function runStatusVariant(
	status: RunStatus,
): "success" | "soft-destructive" | "outline" {
	if (status === "succeeded") {
		return "success";
	}
	if (status === "failed") {
		return "soft-destructive";
	}
	return "outline";
}

export function dataAgeSeconds(updatedAt: string | null): number | null {
	return updatedAt
		? Math.max(0, Math.floor((Date.now() - Date.parse(updatedAt)) / 1000))
		: null;
}

export interface SyncDisplayCourse {
	title: string;
	department: string | null;
	years: number[];
	saz_codes: string[];
}

export interface SyncDisplay {
	name: string | null;
	course: SyncDisplayCourse | null;
	ukmaCourse: SyncDisplayCourse | null;
	courses: SyncDisplayCourse[];
	teacherName: string | null;
}

interface SyncValueObject {
	readonly [key: string]: SyncValue;
}

type SyncValue =
	| string
	| number
	| boolean
	| null
	| readonly SyncValue[]
	| SyncValueObject;

function toValue(value: unknown): SyncValue {
	if (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map(toValue);
	}
	if (typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => {
				const known: unknown = item;
				return [key, toValue(known)];
			}),
		);
	}
	return null;
}

export const readPath = (raw: unknown, ...path: string[]): SyncValue =>
	path.reduce<SyncValue>((value, key) => read(value, key), toValue(raw));

export const numberAt = (raw: unknown, ...path: string[]): number | null => {
	const found = readPath(raw, ...path);
	return typeof found === "number" ? found : null;
};

function read(value: SyncValue, key: string): SyncValue {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return null;
	}
	const entry = Object.entries(value).find(([name]) => name === key);
	return entry === undefined ? null : entry[1];
}

const text = (value: unknown): string | null =>
	typeof value === "string" && value.length > 0 ? value : null;

function numbers(value: unknown): number[] {
	return Array.isArray(value)
		? value.filter((item): item is number => typeof item === "number")
		: [];
}

function strings(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function courseDisplay(value: SyncValue): SyncDisplayCourse | null {
	const title = text(read(value, "title"));
	if (title === null) {
		return null;
	}
	return {
		title,
		department: text(read(value, "department")),
		years: numbers(read(value, "years")),
		saz_codes: strings(read(value, "saz_codes")),
	};
}

const isValueArray = (value: SyncValue): value is readonly SyncValue[] =>
	Array.isArray(value);

function displayCourses(value: SyncValue): SyncDisplayCourse[] {
	return isValueArray(value)
		? value.flatMap((item) => {
				const course = courseDisplay(item);
				return course === null ? [] : [course];
			})
		: [];
}

export function parseDisplay(change: SyncChange): SyncDisplay {
	const after = read(toValue(change.after), "display");
	const before = read(toValue(change.before), "display");
	const raw = after ?? before;
	return {
		name: text(read(raw, "name")),
		course: courseDisplay(read(raw, "course")),
		ukmaCourse: courseDisplay(read(raw, "ukma_course")),
		courses: displayCourses(read(raw, "courses")),
		teacherName: text(read(read(raw, "teacher"), "name")),
	};
}

export function changeTitle(change: SyncChange, display: SyncDisplay): string {
	const payload = toValue(change.after);
	const before = toValue(change.before);
	const recordTitle =
		text(read(before, "title")) ??
		text(read(before, "name")) ??
		text(read(payload, "title"));
	const sazCode = text(read(payload, "saz_code"));
	if (display.teacherName !== null) {
		return display.teacherName;
	}
	if (display.course !== null) {
		return display.course.title;
	}
	if (display.name !== null) {
		return display.name;
	}
	if (display.ukmaCourse !== null) {
		return display.ukmaCourse.title;
	}
	if (display.courses.length === 1) {
		return display.courses[0].title;
	}
	if (display.courses.length > 1) {
		return `${display.courses[0].title} та ще ${display.courses.length - 1}`;
	}
	return recordTitle ?? (sazCode === null ? change.key : `САЗ ${sazCode}`);
}

export interface SyncField {
	key: string;
	before: SyncValue;
	after: SyncValue;
}

export function changedFields(change: SyncChange): SyncField[] {
	const after = toValue(change.after);
	const before = toValue(change.before);
	if (typeof after !== "object" || after === null || Array.isArray(after)) {
		return [];
	}
	return Object.keys(after)
		.filter((key) => key !== "display")
		.map((key) => ({
			key,
			before: read(before, key),
			after: read(after, key),
		}))
		.filter(
			(field) => JSON.stringify(field.before) !== JSON.stringify(field.after),
		);
}

export function formatPayloadValue(value: SyncValue): string {
	if (value == null) {
		return "—";
	}
	if (typeof value === "string" || typeof value === "number") {
		return String(value);
	}
	if (typeof value === "boolean") {
		return value ? "так" : "ні";
	}
	if (isValueArray(value)) {
		return value.length === 0
			? "—"
			: value.map((item) => formatPayloadValue(item)).join(", ");
	}
	return JSON.stringify(value) ?? "—";
}

export function countsSummary(counts: unknown): string[] {
	const root = toValue(counts);
	if (typeof root !== "object" || root === null || Array.isArray(root)) {
		return [];
	}
	return Object.keys(root).flatMap((key) => {
		const value = read(root, key);
		const label = isGroup(key) ? GROUP_LABELS[key] : kindLabel(key);
		if (typeof value === "number") {
			return [`${label}: ${value}`];
		}
		if (typeof value !== "object" || value === null || Array.isArray(value)) {
			return [];
		}
		return Object.keys(value).flatMap((state) => {
			const count = read(value, state);
			return typeof count === "number"
				? [`${label} · ${stateLabel(state)}: ${count}`]
				: [];
		});
	});
}

import type { SyncChange } from "@/lib/api/generated";

export interface SyncDisplayCourse {
	title: string;
	department: string | null;
	years: number[];
	saz_codes: string[];
	ratings: number | null;
}

export interface SyncDisplay {
	name: string | null;
	course: SyncDisplayCourse | null;
	ukmaCourse: SyncDisplayCourse | null;
	courses: SyncDisplayCourse[];
	teacherName: string | null;
}

export interface SyncValueObject {
	readonly [key: string]: SyncValue;
}

export type SyncValue =
	| string
	| number
	| boolean
	| null
	| readonly SyncValue[]
	| SyncValueObject;

export function toValue(value: unknown): SyncValue {
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

export function read(value: SyncValue, key: string): SyncValue {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return null;
	}
	const entry = Object.entries(value).find(([name]) => name === key);
	return entry === undefined ? null : entry[1];
}

export const text = (value: unknown): string | null =>
	typeof value === "string" && value.length > 0 ? value : null;

export function numbers(value: unknown): number[] {
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
		ratings: null,
	};
}

export const isValueArray = (value: SyncValue): value is readonly SyncValue[] =>
	Array.isArray(value);

function displayCourses(value: SyncValue): SyncDisplayCourse[] {
	return isValueArray(value)
		? value.flatMap((item) => {
				const course = courseDisplay(item);
				return course === null ? [] : [course];
			})
		: [];
}

function withRatings(
	courses: SyncDisplayCourse[],
	payload: SyncValue,
): SyncDisplayCourse[] {
	const rows = read(payload, "courses");
	if (!isValueArray(rows)) {
		return courses;
	}
	return courses.map((course, index) => {
		const ratings = read(rows[index], "ratings");
		return {
			...course,
			ratings: typeof ratings === "number" ? ratings : null,
		};
	});
}

export function parseDisplay(change: SyncChange): SyncDisplay {
	const after = read(toValue(change.after), "display");
	const before = read(toValue(change.before), "display");
	const raw = after ?? before;
	return {
		name: text(read(raw, "name")),
		course: courseDisplay(read(raw, "course")),
		ukmaCourse: courseDisplay(read(raw, "ukma_course")),
		courses: withRatings(
			displayCourses(read(raw, "courses")),
			toValue(change.after),
		),
		teacherName: text(read(read(raw, "teacher"), "name")),
	};
}

export function changeTitle(change: SyncChange, display: SyncDisplay): string {
	const payload = toValue(change.after);
	const afterTitle = text(read(payload, "title"));
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
	return afterTitle ?? (sazCode === null ? change.key : `САЗ ${sazCode}`);
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
	const name = text(read(value, "name")) ?? text(read(value, "title"));
	if (name !== null) {
		return name;
	}
	return JSON.stringify(value) ?? "—";
}

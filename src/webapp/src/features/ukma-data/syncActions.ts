import axios from "axios";

import type {
	AnswerEnum,
	ErrorEnvelope,
	SyncChange,
	SyncChangeGroupEnum as Group,
	SyncSourceEnum as Source,
} from "@/lib/api/generated";
import { ukmaDataSyncPendingList } from "@/lib/api/generated";
import type { SyncKindName } from "./sync";
import type { SyncDisplay, SyncField, SyncValue } from "./syncDisplay";
import {
	formatPayloadValue,
	isValueArray,
	parseDisplay,
	read,
	text,
	toValue,
} from "./syncDisplay";

export const STALE_TITLE = "Дані старші за 48 год";
export const LOCK_MESSAGE = "Синхронізація саме триває";
export const EMPTY_SELECTION = "Немає запропонованих змін для цієї вибірки";
const FALLBACK_ERROR = "Не вдалося виконати дію. Спробуйте ще раз.";

export interface Refusal {
	detail: string;
	stale: boolean;
	lock: boolean;
	empty: boolean;
}

export function refusalOf(error: unknown): Refusal {
	if (!axios.isAxiosError<ErrorEnvelope>(error)) {
		return {
			detail: FALLBACK_ERROR,
			stale: false,
			lock: false,
			empty: false,
		};
	}
	const envelope: ErrorEnvelope | undefined = error.response?.data;
	const fields: ErrorEnvelope["fields"] = envelope?.fields;
	const fieldMessage =
		fields === undefined ? undefined : Object.values(fields)[0]?.[0];
	const detail = fieldMessage ?? envelope?.detail ?? FALLBACK_ERROR;
	const status = error.response?.status;
	return {
		detail,
		stale: status === 409 && detail.startsWith(STALE_TITLE),
		lock: status === 409 && detail === LOCK_MESSAGE,
		empty: detail === EMPTY_SELECTION,
	};
}

export function countsText(counts: ApprovalCounts): string {
	return [
		`Застосується: ${counts.applied}`,
		`Замінено: ${counts.superseded}`,
		`Очікує: ${counts.waiting}`,
		counts.skipped > 0 ? `Пропущено: ${counts.skipped}` : null,
	]
		.filter((part): part is string => part !== null)
		.join(" · ");
}

export function approveBody(
	request: SyncRequest,
	dryRun: boolean,
	confirmStale: boolean,
) {
	return {
		source: request.source,
		group: request.group,
		kind: request.kind ?? null,
		change_ids: request.changeIds,
		dry_run: dryRun,
		confirm_stale: confirmStale,
	};
}

export async function collectPendingIds(
	source: Source,
	group: Group,
	kind?: string,
): Promise<number[]> {
	const ids: number[] = [];
	let page = 1;
	for (;;) {
		const response = await ukmaDataSyncPendingList({
			source,
			group,
			kind,
			page,
			page_size: 100,
		});
		ids.push(
			...response.items
				.filter((item) => item.state === "proposed")
				.map((item) => item.id),
		);
		if (response.next_page === null) {
			return ids;
		}
		page = response.next_page;
	}
}

export const KIND_SOURCES = {
	new_faculty: "catalog",
	link_faculty: "catalog",
	change_faculty: "catalog",
	new_department: "catalog",
	link_department: "catalog",
	change_department: "catalog",
	new_course: "catalog",
	link_course: "catalog",
	change_course: "catalog",
	new_offering: "catalog",
	link_offering: "catalog",
	change_offering: "catalog",
	teacher_created: "teachers",
	teacher_link_added: "teachers",
	teacher_link_removed: "teachers",
	relink_course: "catalog",
	place_offering: "catalog",
	move_offering: "catalog",
	merge_courses: "catalog",
	removed_course: "catalog",
	removed_offering: "catalog",
} satisfies Record<SyncKindName, Source>;

export const KIND_GROUPS = {
	new_faculty: "new",
	link_faculty: "link",
	change_faculty: "change",
	new_department: "new",
	link_department: "link",
	change_department: "change",
	new_course: "new",
	link_course: "link",
	change_course: "change",
	new_offering: "new",
	link_offering: "link",
	change_offering: "change",
	teacher_created: "new",
	teacher_link_added: "change",
	teacher_link_removed: "change",
	relink_course: "mapping",
	place_offering: "mapping",
	move_offering: "mapping",
	merge_courses: "mapping",
	removed_course: "removed",
	removed_offering: "removed",
} satisfies Record<SyncKindName, Group>;

const TEACHER_KINDS = new Set<string>([
	"teacher_created",
	"teacher_link_added",
	"teacher_link_removed",
]);

const isKnownKind = (kind: string): kind is keyof typeof KIND_SOURCES =>
	kind in KIND_SOURCES;

export const kindSource = (kind: string): Source | null =>
	isKnownKind(kind) ? KIND_SOURCES[kind] : null;

export const kindGroup = (kind: string): Group | null =>
	isKnownKind(kind) ? KIND_GROUPS[kind] : null;

export const isTeacherChange = (change: SyncChange): boolean =>
	TEACHER_KINDS.has(change.kind);

export const isMappingChange = (change: SyncChange): boolean =>
	change.group === "mapping";

export const isRemovedChange = (change: SyncChange): boolean =>
	change.group === "removed";

export const teacherUnitKey = (change: SyncChange): string =>
	change.target_id === null
		? `teacher:${change.key}`
		: `offering:${change.target_id}`;

export interface SyncRequest {
	source: Source;
	group: Group;
	kind?: string;
	changeIds?: number[];
	rows: number;
}

export function selectionRequests(changes: SyncChange[]): SyncRequest[] {
	const groups = new Map<
		string,
		{ source: Source; group: Group; ids: number[]; kinds: Set<string> }
	>();
	for (const change of changes) {
		const key = `${change.source}|${change.group}`;
		const entry = groups.get(key) ?? {
			source: change.source,
			group: change.group,
			ids: [],
			kinds: new Set<string>(),
		};
		entry.ids.push(change.id);
		entry.kinds.add(change.kind);
		groups.set(key, entry);
	}
	return [...groups.values()].map((entry) => ({
		source: entry.source,
		group: entry.group,
		kind: entry.kinds.size === 1 ? [...entry.kinds][0] : undefined,
		changeIds: entry.ids,
		rows: entry.ids.length,
	}));
}

export const totalRows = (requests: SyncRequest[]): number =>
	requests.reduce((total, request) => total + request.rows, 0);

export const ANSWER_LABELS = {
	keep_apart: "Залишити окремо",
	merge: "Обʼєднати",
	keep: "Залишити",
	move: "Перенести",
	place: "Розмістити тут",
	relink: "Перепривʼязати",
} satisfies Record<AnswerEnum, string>;

export const ANSWERS_BY_KIND = {
	merge_courses: ["keep_apart", "merge"],
	move_offering: ["keep", "move"],
	relink_course: ["keep", "relink"],
	place_offering: ["place"],
} satisfies Partial<Record<SyncKindName, readonly AnswerEnum[]>>;

export const answersFor = (kind: string): readonly AnswerEnum[] => {
	for (const [name, answers] of Object.entries(ANSWERS_BY_KIND)) {
		if (name === kind) {
			return answers;
		}
	}
	return [];
};

export interface MappingCourse {
	id: string | null;
	title: string;
	department: string | null;
	years: number[];
	ratings: number | null;
}

function courseIds(change: SyncChange): string[] {
	const after = toValue(change.after);
	if (change.kind === "merge_courses") {
		const rows = read(after, "courses");
		return isValueArray(rows)
			? rows.map((row) => text(read(row, "id")) ?? "")
			: [];
	}
	if (change.kind === "place_offering") {
		const rows = read(after, "candidates");
		return isValueArray(rows)
			? rows.filter((row): row is string => typeof row === "string")
			: [];
	}
	if (change.kind === "move_offering") {
		return [
			text(read(after, "from_course")) ?? "",
			text(read(after, "to_course_id")) ?? "",
		];
	}
	return [];
}

export function mappingCourses(change: SyncChange): MappingCourse[] {
	const display = parseDisplay(change);
	const ids = courseIds(change);
	return display.courses.map((course, index) => ({
		id: ids[index] === "" ? null : (ids[index] ?? null),
		title: course.title,
		department: course.department,
		years: course.years,
		ratings: course.ratings,
	}));
}

const MERGE_SOURCE_LABELS = {
	rule: "правило кафедри",
	decision: "рішення працівника",
} satisfies Record<string, string>;

const mergeSourceLabel = (value: string): string => {
	for (const [name, label] of Object.entries(MERGE_SOURCE_LABELS)) {
		if (name === value) {
			return label;
		}
	}
	return value;
};

function namedValue(
	change: SyncChange,
	key: string,
	value: SyncValue,
	display: SyncDisplay,
): string | null {
	const after = toValue(change.after);
	const matchesAfter =
		JSON.stringify(value) === JSON.stringify(read(after, key));
	switch (key) {
		case "course_id":
		case "course_ukma_id":
			return matchesAfter ? (display.course?.title ?? null) : null;
		case "instructor_id":
		case "teacher_email":
			return display.teacherName;
		case "from_course":
			return matchesAfter ? (display.courses[0]?.title ?? null) : null;
		case "to_course_id":
		case "to_course_ukma_id":
			return matchesAfter
				? (display.courses[1]?.title ?? display.courses[0]?.title ?? null)
				: null;
		case "candidates":
		case "courses":
			return matchesAfter && display.courses.length > 0
				? display.courses.map((course) => course.title).join(", ")
				: null;
		case "ukma_data_id":
			return matchesAfter
				? (display.ukmaCourse?.title ?? display.course?.title ?? null)
				: null;
		case "merge_source": {
			const source = text(value);
			return source === null ? null : mergeSourceLabel(source);
		}
		default:
			return null;
	}
}

export function formatFieldValue(
	change: SyncChange,
	field: SyncField,
	display: SyncDisplay,
) {
	const before =
		namedValue(change, field.key, field.before, display) ??
		formatPayloadValue(field.before);
	const after =
		namedValue(change, field.key, field.after, display) ??
		formatPayloadValue(field.after);
	return { before, after };
}

export interface ApprovalCounts {
	applied: number;
	rejected: number;
	superseded: number;
	waiting: number;
	skipped: number;
}

export function readApprovalCounts(counts: unknown): ApprovalCounts {
	const root = toValue(counts);
	const value = (key: string): number => {
		const item = read(root, key);
		return typeof item === "number" ? item : 0;
	};
	return {
		applied: value("applied"),
		rejected: value("rejected"),
		superseded: value("superseded"),
		waiting: value("waiting"),
		skipped: value("skipped"),
	};
}

export function sumApprovalCounts(rows: ApprovalCounts[]): ApprovalCounts {
	return rows.reduce(
		(total, row) => ({
			applied: total.applied + row.applied,
			rejected: total.rejected + row.rejected,
			superseded: total.superseded + row.superseded,
			waiting: total.waiting + row.waiting,
			skipped: total.skipped + row.skipped,
		}),
		{ applied: 0, rejected: 0, superseded: 0, waiting: 0, skipped: 0 },
	);
}

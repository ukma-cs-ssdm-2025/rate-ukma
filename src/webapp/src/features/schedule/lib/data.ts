import {
	fromRows,
	LessonRow,
	Offering,
	resolveVariants,
	type Week,
	type WeekDates,
} from "@/features/schedule/core";
import { Schema } from "effect";

/** A row the parser could not validate — shown raw, with its source file. */
export const ReviewItem = Schema.Struct({
	source: Schema.String,
	day: Schema.NullOr(Schema.String),
	time: Schema.String,
	discipline: Schema.String,
	group: Schema.String,
	weeks: Schema.String,
	room: Schema.String,
	problems: Schema.Array(Schema.String),
});
export interface ReviewItem extends Schema.Schema.Type<typeof ReviewItem> {}

const WeekSpans = Schema.Record(
	Schema.String,
	Schema.Struct({ start: Schema.String, end: Schema.String }),
);

const Files = Schema.Array(
	Schema.Struct({
		source: Schema.String,
		label: Schema.String,
		url: Schema.String,
		/** Our archived copy of the latest version («/files/<sha>.xlsx»). */
		stored: Schema.optionalKey(Schema.NullOr(Schema.String)),
		fetchedAt: Schema.optionalKey(Schema.NullOr(Schema.String)),
	}),
);

const SemesterData = Schema.Struct({
	semester: Schema.String,
	/** When the САЗ files were last read (ISO). */
	ingestedAt: Schema.String,
	/** Total lesson rows on the server; pages are fetched until it is reached. */
	rowsTotal: Schema.Number,
	rows: Schema.Array(LessonRow),
	review: Schema.Array(ReviewItem),
	weekDates: WeekSpans,
	files: Files,
});
export interface SemesterData extends Schema.Schema.Type<typeof SemesterData> {}

const decodeSemesterSync = Schema.decodeUnknownSync(SemesterData);

/** /api/me/timetable: the offerings one student's plan and ІНП point at,
 *  already grouped and resolved by the server. */
const TimetableData = Schema.Struct({
	semester: Schema.String,
	ingestedAt: Schema.String,
	offerings: Schema.Array(Offering),
	review: Schema.Array(ReviewItem),
	weekDates: WeekSpans,
	files: Files,
});

const decodeTimetableSync = Schema.decodeUnknownSync(TimetableData);

export interface Semester {
	readonly name: string;
	readonly ingestedAt: string;
	readonly rows: ReadonlyArray<LessonRow>;
	readonly offerings: ReadonlyArray<Offering>;
	readonly review: ReadonlyArray<ReviewItem>;
	readonly weekDates: WeekDates;
	readonly files: SemesterData["files"];
}

const weekDatesOf = (spans: SemesterData["weekDates"]): WeekDates =>
	new Map(
		// SAFETY: weekDates keys are week ordinals serialized by the parser.
		Object.entries(spans).map(([week, span]) => [Number(week) as Week, span]),
	);

const decodeSemesterListSync = Schema.decodeUnknownSync(
	Schema.Struct({ semesters: Schema.Array(Schema.String) }),
);

/** Every ingested semester name, current first. */
export const listSemesters = async (): Promise<ReadonlyArray<string>> => {
	const response = await fetch("/api/schedule/semesters");
	if (!response.ok)
		throw new Error(`Не вдалося завантажити семестри: ${response.status}`);
	return decodeSemesterListSync(await response.json()).semesters;
};

/** Larger than any semester so far (autumn 2026: 7.6k rows), so the whole
 *  corpus is one request; the paging loop below is the fallback, not the path. */
const PAGE_SIZE = 10000;

const fetchSemesterPage = async (
	name: string | undefined,
	offset: number,
): Promise<SemesterData> => {
	const params = new URLSearchParams({
		offset: String(offset),
		limit: String(PAGE_SIZE),
	});
	if (name) params.set("semester", name);
	const response = await fetch(`/api/schedule/semester?${params.toString()}`);
	if (!response.ok)
		throw new Error(`Не вдалося завантажити розклад: ${response.status}`);
	return decodeSemesterSync(await response.json());
};

export const loadSemester = async (name?: string): Promise<Semester> => {
	const data = await fetchSemesterPage(name, 0);
	// The first page says how many rows there are; whatever is left comes in
	// parallel rather than one round trip after another.
	const offsets: number[] = [];
	for (
		let offset = data.rows.length;
		offset < data.rowsTotal;
		offset += PAGE_SIZE
	) {
		offsets.push(offset);
	}
	const rest = await Promise.all(
		offsets.map((offset) => fetchSemesterPage(name ?? data.semester, offset)),
	);
	const allRows = [...data.rows, ...rest.flatMap((page) => page.rows)];
	const labels = new Map(data.files.map((file) => [file.source, file.label]));
	const rows = resolveVariants(
		allRows,
		(source) => labels.get(source) ?? source,
	);
	return {
		name: data.semester,
		ingestedAt: data.ingestedAt,
		rows,
		offerings: fromRows(rows),
		review: data.review,
		weekDates: weekDatesOf(data.weekDates),
		files: data.files,
	};
};

/** The signed-in student's slice of a semester: enough for their grid, their
 *  groups and their ІНП, not for the catalog. Null when signed out. */
export const loadTimetable = async (
	name?: string,
): Promise<Semester | null> => {
	const params = new URLSearchParams();
	if (name) params.set("semester", name);
	const response = await fetch(
		`/api/schedule/me/timetable?${params.toString()}`,
	);
	if (response.status === 401) return null;
	if (!response.ok)
		throw new Error(`Не вдалося завантажити розклад: ${response.status}`);
	const data = decodeTimetableSync(await response.json());
	return {
		name: data.semester,
		ingestedAt: data.ingestedAt,
		rows: data.offerings.flatMap((offering) => [
			...offering.lectures,
			...Object.values(offering.groups).flat(),
		]),
		offerings: data.offerings,
		review: data.review,
		weekDates: weekDatesOf(data.weekDates),
		files: data.files,
	};
};

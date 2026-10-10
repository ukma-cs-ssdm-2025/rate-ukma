import {
	CustomLessons,
	LessonChange,
	LessonRow,
	Overrides,
} from "@/features/schedule/core";
import { Schema } from "effect";
import { InpEntry } from "@/features/schedule/core";

/** What GET /api/me returns for a signed-in student. */
const Me = Schema.Struct({
	user: Schema.Struct({
		name: Schema.String,
		email: Schema.String,
		/** A profile photo is kept; `/api/schedule/me/avatar` serves it. */
		avatar: Schema.optionalKey(Schema.Boolean),
	}),
	/** Path segment of this student's calendar feed. */
	icsToken: Schema.String,
	/** When a calendar client last polled the feed; null until one does. */
	feedFetchedAt: Schema.optionalKey(Schema.NullOr(Schema.String)),
	/** Which client that was: Google, Apple, Outlook or «Інший». */
	feedClient: Schema.optionalKey(Schema.NullOr(Schema.String)),
	/** The student's programme and year as САЗ rosters have it; null when unknown. */
	programme: Schema.optionalKey(
		Schema.NullOr(Schema.Struct({ name: Schema.String, grade: Schema.Number })),
	),
	inp: Schema.Array(InpEntry),
	plan: Schema.Struct({
		picked: Schema.Array(Schema.String),
		selection: Schema.Record(Schema.String, Schema.String),
		registered: Schema.Record(Schema.String, Schema.String),
		/** Disciplines the student hid with the eye toggle; the grid and the feed skip them. */
		hidden: Schema.optionalKey(Schema.Array(Schema.String)),
		/** Long names as their initials on the grid and in every calendar. */
		shortNames: Schema.optionalKey(Schema.Boolean),
		/** Lessons the student corrected, keyed by the printed lesson. */
		overrides: Schema.optionalKey(Overrides),
		/** Lessons the student added by hand because no sheet prints them. */
		custom: Schema.optionalKey(CustomLessons),
		/** The student called the plan final; the page offers no edits until they unlock it. */
		locked: Schema.optionalKey(Schema.Boolean),
		/** ISO timestamp of the last САЗ crawl that touched this student; null until the first one. */
		sazSyncedAt: Schema.NullOr(Schema.String),
	}),
});
export interface Me extends Schema.Schema.Type<typeof Me> {}

const decodeMeSync = Schema.decodeUnknownSync(Me);

const ConfigSchema = Schema.Struct({
	microsoftAuth: Schema.Boolean,
	devLogin: Schema.Boolean,
});
const decodeConfigSync = Schema.decodeUnknownSync(ConfigSchema);

/** What the server has configured; assume Microsoft login exists on failure,
 *  so an unreachable API still offers the only real way in. */
export interface AppConfig {
	readonly microsoftAuth: boolean;
	readonly devLogin: boolean;
}
export const fetchConfig = async (): Promise<AppConfig> => {
	try {
		const response = await fetch("/api/schedule/config");
		if (!response.ok) return { microsoftAuth: true, devLogin: false };
		return decodeConfigSync(await response.json());
	} catch {
		return { microsoftAuth: true, devLogin: false };
	}
};

export const devLogin = async (email: string, name?: string): Promise<void> => {
	const response = await fetch("/auth/dev-login", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ email, name }),
	});
	if (!response.ok) throw new Error(`dev login failed: ${response.status}`);
};

/** The profile with the plan for one semester: the current one, or the
 *  archive named. Every request is per semester: `?semester=` on both. */
const withSemester = (path: string, semester: string | undefined): string =>
	semester === undefined
		? path
		: `${path}?${new URLSearchParams({ semester }).toString()}`;

/** null = not signed in. Any other failure throws. */
export const fetchMe = async (semester?: string): Promise<Me | null> => {
	const response = await fetch(withSemester("/api/schedule/me", semester));
	if (response.status === 401) return null;
	if (!response.ok)
		throw new Error(`Не вдалося завантажити профіль: ${response.status}`);
	return decodeMeSync(await response.json());
};

/** `registered` is САЗ's alone and never travels this way. */
export interface PlanUpdate {
	readonly picked: ReadonlyArray<string>;
	readonly selection: Readonly<Record<string, string>>;
	readonly hidden: ReadonlyArray<string>;
	readonly shortNames: boolean;
	readonly overrides: Overrides;
	readonly custom: CustomLessons;
	readonly locked: boolean;
}

/** One ingest of the semester: when САЗ's files were read and what moved. */
const ScheduleVersion = Schema.Struct({
	id: Schema.Number,
	at: Schema.String,
	rows: Schema.Number,
	review: Schema.Number,
	rowsAdded: Schema.Number,
	rowsRemoved: Schema.Number,
	filesChanged: Schema.Array(Schema.String),
	/** Disciplines whose rows moved in this reading; the tick narrows on it. */
	disciplinesChanged: Schema.optionalKey(Schema.Array(Schema.String)),
});
export interface ScheduleVersion extends Schema.Schema.Type<
	typeof ScheduleVersion
> {}

const decodeVersionsSync = Schema.decodeUnknownSync(
	Schema.Struct({ versions: Schema.Array(ScheduleVersion) }),
);
const decodeVersionRowsSync = Schema.decodeUnknownSync(
	Schema.Struct({
		id: Schema.Number,
		at: Schema.String,
		rows: Schema.Array(LessonRow),
	}),
);

/** Every ingest of a semester, newest first. */
export const fetchVersions = async (
	semester: string,
): Promise<ReadonlyArray<ScheduleVersion>> => {
	const params = new URLSearchParams({ semester });
	const response = await fetch(
		`/api/schedule/semester/versions?${params.toString()}`,
	);
	if (!response.ok)
		throw new Error(`Не вдалося завантажити версії: ${response.status}`);
	return decodeVersionsSync(await response.json()).versions;
};

/** The rows exactly as one ingest stored them. */
export const fetchVersionRows = async (
	id: number,
): Promise<ReadonlyArray<LessonRow>> => {
	const response = await fetch(`/api/schedule/semester/versions/${id}`);
	if (!response.ok)
		throw new Error(`Не вдалося завантажити версію: ${response.status}`);
	return decodeVersionRowsSync(await response.json()).rows;
};

/** What changed in the student's own lessons since the reading they last
 *  dismissed, up to the newest reading that has held for an hour. */
const LessonChanges = Schema.Struct({
	fromIngestId: Schema.NullOr(Schema.Number),
	toIngestId: Schema.NullOr(Schema.Number),
	toAt: Schema.NullOr(Schema.String),
	changes: Schema.Array(LessonChange),
});
export interface LessonChanges extends Schema.Schema.Type<
	typeof LessonChanges
> {}

const decodeChangesSync = Schema.decodeUnknownSync(LessonChanges);

export const fetchChanges = async (
	semester?: string,
): Promise<LessonChanges> => {
	const response = await fetch(
		withSemester("/api/schedule/me/changes", semester),
	);
	if (!response.ok)
		throw new Error(`Не вдалося завантажити зміни: ${response.status}`);
	return decodeChangesSync(await response.json());
};

/** «Зрозуміло»: the changes up to this reading are seen. */
export const markChangesSeen = async (
	ingestId: number,
	semester?: string,
): Promise<void> => {
	const response = await fetch(
		withSemester("/api/schedule/me/changes/seen", semester),
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ ingestId }),
		},
	);
	if (!response.ok)
		throw new Error(`Не вдалося позначити зміни: ${response.status}`);
};

export const savePlan = async (
	plan: PlanUpdate,
	semester?: string,
): Promise<void> => {
	const response = await fetch(
		withSemester("/api/schedule/me/plan", semester),
		{
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(plan),
		},
	);
	if (!response.ok)
		throw new Error(`Не вдалося зберегти план: ${response.status}`);
};

/** Bind an ІНП line the matcher could not place to a parsed discipline name. */
export const setInpMatch = async (
	courseId: string,
	match: string,
	variantLabel: string | undefined,
): Promise<void> => {
	const response = await fetch(
		`/api/schedule/me/inp/${encodeURIComponent(courseId)}`,
		{
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ match, variantLabel: variantLabel ?? null }),
		},
	);
	if (!response.ok)
		throw new Error(`Не вдалося зберегти відповідність: ${response.status}`);
};

export const logout = async (): Promise<void> => {
	await fetch("/auth/logout", { method: "POST" });
};

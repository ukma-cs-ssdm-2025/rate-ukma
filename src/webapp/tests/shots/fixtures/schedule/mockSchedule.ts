import type { Page } from "@playwright/test";

import { Schema } from "effect";

import {
	fromRows,
	LessonRow,
	matchOfferings,
	resolveVariants,
} from "../../../../src/features/schedule/core";
import { ME_RETURNING, type MeFixture } from "./me";
import { NO_CHANGES, SEMESTER_FIXTURE, VERSIONS_FIXTURE } from "./semester";

/** The parts of a /api/schedule/semester payload the slice is cut from. */
interface CorpusFixture {
	readonly semester: string;
	readonly ingestedAt: string;
	readonly rows: ReadonlyArray<unknown>;
	readonly review: ReadonlyArray<{ readonly source: string }>;
	readonly weekDates: unknown;
	readonly files: ReadonlyArray<{
		readonly source: string;
		readonly label: string;
	}>;
}

/** /api/schedule/me/timetable as the service builds it: the plan's offerings
 *  and every stream the ІНП matches, with the week dates and files. */
const timetableOf = (
	me: MeFixture,
	corpus: CorpusFixture = SEMESTER_FIXTURE,
) => {
	const labels = new Map(corpus.files.map((file) => [file.source, file.label]));
	const rows = Schema.decodeUnknownSync(Schema.Array(LessonRow))(corpus.rows);
	const all = fromRows(
		resolveVariants(rows, (source) => labels.get(source) ?? source),
	);
	const wanted = new Set<string>(me.plan.picked);
	for (const entry of me.inp)
		for (const hit of matchOfferings(all, entry)) wanted.add(hit.disciplineId);
	const offerings = all.filter((o) => wanted.has(o.disciplineId));
	const sources = new Set(
		offerings.flatMap((o) =>
			[...o.lectures, ...Object.values(o.groups).flat()].map(
				(row) => row.source,
			),
		),
	);
	return {
		semester: corpus.semester,
		ingestedAt: corpus.ingestedAt,
		offerings,
		review: corpus.review.filter((item) => sources.has(item.source)),
		weekDates: corpus.weekDates,
		files: corpus.files,
	};
};

/**
 * Serves the schedule service under /api/schedule from the fixtures the
 * standalone app's own tests use. Rate UKMA's /api/v1 stays with mockBackend.
 */
export async function mockSchedule(
	page: Page,
	{ me = ME_RETURNING }: { me?: MeFixture } = {},
): Promise<void> {
	await page.route("**/api/schedule/semesters", (route) =>
		route.fulfill({ json: { semesters: [SEMESTER_FIXTURE.semester] } }),
	);
	await page.route("**/api/schedule/config", (route) =>
		route.fulfill({ json: { microsoftAuth: true, devLogin: false } }),
	);
	await page.route(/\/api\/schedule\/semester(\?.*)?$/, (route) =>
		route.fulfill({ json: SEMESTER_FIXTURE }),
	);
	await page.route("**/api/schedule/semester/versions?*", (route) =>
		route.fulfill({ json: { versions: VERSIONS_FIXTURE.list } }),
	);
	await page.route(/\/api\/schedule\/me(\?.*)?$/, (route) =>
		route.fulfill({ json: me }),
	);
	await page.route(/\/api\/schedule\/me\/timetable(\?.*)?$/, (route) =>
		route.fulfill({ json: timetableOf(me) }),
	);
	await page.route(/\/api\/schedule\/me\/changes(\?.*)?$/, (route) =>
		route.fulfill({ json: NO_CHANGES }),
	);
	await page.route(/\/api\/schedule\/me\/changes\/seen(\?.*)?$/, (route) =>
		route.fulfill({ status: 204 }),
	);
	await page.route(/\/api\/schedule\/me\/plan(\?.*)?$/, (route) =>
		route.fulfill({ status: 204 }),
	);
	await page.route("**/api/schedule/events", (route) =>
		route.fulfill({ status: 204 }),
	);
}

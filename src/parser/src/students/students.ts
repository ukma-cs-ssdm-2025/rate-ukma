import { Array as Arr, Clock, Effect, Result } from "effect";
import { type ChangeCount, mergeChangeCounts } from "../changes/ChangeLog.ts";
import {
	OfferingStore,
	type ParseFailure,
	type ParseReport,
	type ParseTrigger,
} from "../offerings/OfferingStore.ts";
import { parseStudentsPage } from "../saz/studentsPage.ts";
import { batchesOf, type StudentList } from "./rows.ts";
import { StudentStore } from "./StudentStore.ts";

const READ_SIZE = 100;

/** Entries per write, not pages: one list can hold over a thousand (D13). */
const BATCH_ENTRIES = 5000;

/** `parsed` counts lists. A list that fails to parse or store is kept: its
 *  offering's enrollments stay as they were. */
export interface StudentParseReport extends ParseReport {
	readonly listsEmptied: number;
	readonly listsKept: number;
}

/** Parses the latest students page of each offering into students and
 *  enrollments (spec rule 6, per list). A crawl skips a list whose latest
 *  snapshot is already applied; a reparse applies every list again. */
export const parseStudents = Effect.fn("parseStudents")(function* (
	trigger: ParseTrigger,
) {
	const parses = yield* OfferingStore;
	const store = yield* StudentStore;
	const startedAt = yield* Clock.currentTimeMillis;
	const parseId = yield* parses.startParse(trigger);
	const failed = new Map<string, number>();
	let changes: ReadonlyArray<ChangeCount> = [];
	let parsed = 0;
	let emptied = 0;

	const fail = (reason: string, count: number) =>
		failed.set(reason, (failed.get(reason) ?? 0) + count);

	const ids = yield* store.latestStudentPages(trigger);

	for (const chunk of Arr.chunksOf(ids, READ_SIZE)) {
		const lists: Array<StudentList> = [];
		const failures: Array<ParseFailure> = [];

		for (const page of yield* store.pages(chunk)) {
			const result = parseStudentsPage(page.content);

			if (Result.isSuccess(result)) {
				lists.push({
					snapshotId: page.id,
					sazCode: page.sazCode,
					entries: result.success,
				});
				continue;
			}

			const { reason } = result.failure;

			fail(reason, 1);
			failures.push({ snapshotId: page.id, path: page.path, reason });
			yield* Effect.logWarning("Students page failed to parse", {
				path: page.path,
				snapshot_id: String(page.id),
				reason,
			});
		}

		for (const batch of batchesOf(lists, BATCH_ENTRIES)) {
			const written = yield* store.write(batch, parseId).pipe(
				Effect.catchCause((cause) =>
					Effect.logError("Students batch failed to store", {
						first_snapshot_id: String(batch[0]?.snapshotId),
						last_snapshot_id: String(batch.at(-1)?.snapshotId),
						cause,
					}).pipe(Effect.as(undefined)),
				),
			);

			if (written === undefined) {
				fail("store", batch.length);
				failures.push(
					...batch.map(({ snapshotId, sazCode }) => ({
						snapshotId,
						path: `/course/${sazCode}/students`,
						reason: "store",
					})),
				);
				continue;
			}

			parsed += written.parsed;
			emptied += written.emptied.length;
			changes = mergeChangeCounts([...changes, ...written.changes]);

			if (written.emptied.length > 0) {
				yield* Effect.logWarning("Students lists emptied", {
					saz_codes: written.emptied,
				});
			}
		}

		yield* parses.recordFailures(parseId, failures);
	}

	const report: StudentParseReport = {
		seconds: Math.round(((yield* Clock.currentTimeMillis) - startedAt) / 1000),
		parsed,
		failed: Array.from(failed, ([reason, pages]) => ({ reason, pages })),
		changes,
		listsEmptied: emptied,
		listsKept: [...failed.values()].reduce((sum, pages) => sum + pages, 0),
	};

	yield* parses.finishParse(parseId, report);
	yield* Effect.logInfo("Students parsed", report).pipe(
		Effect.annotateLogs({ parse_id: String(parseId), trigger }),
	);

	return report;
});

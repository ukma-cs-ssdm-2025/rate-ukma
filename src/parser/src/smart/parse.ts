import { Clock, Effect, Option, Result } from "effect";
import {
	OfferingStore,
	type ParseTrigger,
} from "../offerings/OfferingStore.ts";
import { type SmartList, smartRowsOf } from "./catalog.ts";
import { SmartStore } from "./SmartStore.ts";

const PATHS: Readonly<Record<SmartList, string>> = {
	departments: "/api/department",
	teachers: "/api/teacher",
	disciplines: "/api/discipline",
	links: "/api/teacher/disciplines",
};

/** Rebuilds teachers and disciplines from the newest stored smart.ukma
 *  lists, recorded as a parse like САЗ's, so its changes carry the parse id.
 *  Nothing to do before the first crawl. A refused list is recorded as the
 *  parse's failure and fails it, leaving the tables as they were; a parse
 *  that finds newer lists stored meanwhile writes nothing. */
export const parseSmart = Effect.fn("Smart.parseSmart")(function* (
	trigger: ParseTrigger,
) {
	const store = yield* SmartStore;
	const parses = yield* OfferingStore;
	const stored = yield* store.latest();

	if (Option.isNone(stored)) {
		return yield* Effect.logInfo("No smart.ukma lists stored yet");
	}

	const startedAt = yield* Clock.currentTimeMillis;
	const parseId = yield* parses.startParse(trigger);

	const seconds = Effect.map(Clock.currentTimeMillis, (now) =>
		Math.round((now - startedAt) / 1000),
	);

	const rows = smartRowsOf(stored.value.lists);

	if (Result.isFailure(rows)) {
		const { list, reason } = rows.failure;

		yield* parses.recordFailures(parseId, [
			{ snapshotId: stored.value.snapshotIds[list], path: PATHS[list], reason },
		]);
		yield* parses.finishParse(parseId, {
			seconds: yield* seconds,
			parsed: 0,
			failed: [{ reason, pages: 1 }],
			changes: [],
		});

		return yield* rows.failure;
	}

	const written = yield* store.write(
		rows.success.instructors,
		rows.success.disciplines,
		stored.value,
		{ parseId },
	);

	const report = {
		seconds: yield* seconds,
		parsed: Option.isSome(written) ? 4 : 0,
		failed: [],
		changes: yield* parses.changeCounts(parseId),
	};

	yield* parses.finishParse(parseId, report);
	yield* Effect.logInfo(
		Option.isSome(written)
			? "smart.ukma lists parsed"
			: "smart.ukma parse skipped: newer lists were stored meanwhile",
		{ report },
	).pipe(Effect.annotateLogs({ parse_id: String(parseId), trigger }));
});

import { Effect, Option } from "effect";
import { smartRowsOf } from "./catalog.ts";
import { SmartStore } from "./SmartStore.ts";

/** Rebuilds teachers and disciplines from the newest stored smart.ukma
 *  lists. Nothing to do before the first crawl; a list that does not decode
 *  fails the parse and leaves the tables as they were. */
export const parseSmart = Effect.fn("parseSmart")(function* () {
	const store = yield* SmartStore;
	const stored = yield* store.latest();

	if (Option.isNone(stored)) {
		return yield* Effect.logInfo("No smart.ukma lists stored yet");
	}

	const rows = yield* Effect.fromResult(smartRowsOf(stored.value.lists));

	const written = yield* store.write(
		rows.instructors,
		rows.disciplines,
		stored.value,
		{},
	);

	yield* Effect.logInfo("smart.ukma lists parsed", { written });
});

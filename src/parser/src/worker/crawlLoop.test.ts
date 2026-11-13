import { assert, describe, it } from "@effect/vitest";
import { Duration, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { crawlLoop } from "./crawlLoop.ts";

/** The loop with fake steps: `waits` are what `nextWait` answers in turn,
 *  then a day; `log` records each step and the `triedAt` it was asked with. */
const makeSteps = (waits: ReadonlyArray<Duration.Input>, signedIn = true) => {
	const log: Array<string> = [];
	const pending = waits.map(Duration.fromInputUnsafe);

	const steps = {
		nextWait: (triedAt: number | undefined) =>
			Effect.sync(() => {
				log.push(`wait ${triedAt ?? "none"}`);

				return pending.shift() ?? Duration.hours(24);
			}),
		crawl: Effect.sync(() => {
			log.push("crawl");

			return signedIn;
		}),
		parse: Effect.sync(() => {
			log.push("parse");
		}),
	};

	return { log, steps };
};

describe("crawlLoop", () => {
	it.effect("parses on start, reads the wait again, then crawls", () => {
		const { log, steps } = makeSteps(["6 hours", "5 hours"]);

		return Effect.gen(function* () {
			const fiber = yield* Effect.forkChild(crawlLoop(steps));

			yield* TestClock.adjust(Duration.minutes(299));
			const beforeDue = [...log];

			yield* TestClock.adjust("1 minute");
			yield* Fiber.interrupt(fiber);

			assert.deepStrictEqual(beforeDue, ["wait none", "parse", "wait none"]);
			assert.deepStrictEqual(log.slice(3), [
				"crawl",
				"parse",
				`wait ${Duration.toMillis(Duration.hours(5))}`,
			]);
		});
	});

	it.effect("crawls at once, with no startup parse, when one is due", () => {
		const { log, steps } = makeSteps([0, 0]);

		return Effect.gen(function* () {
			const fiber = yield* Effect.forkChild(crawlLoop(steps));

			yield* TestClock.adjust("1 millis");
			yield* Fiber.interrupt(fiber);

			assert.deepStrictEqual(log.slice(0, 4), [
				"wait none",
				"wait none",
				"crawl",
				"parse",
			]);
		});
	});

	it.effect("parses and stops after a failed sign-in", () => {
		const { log, steps } = makeSteps([0, 0, 0, 0], false);

		return Effect.gen(function* () {
			const fiber = yield* Effect.forkChild(crawlLoop(steps));

			yield* TestClock.adjust("2 days");
			yield* Fiber.join(fiber);

			assert.deepStrictEqual(log, ["wait none", "wait none", "crawl", "parse"]);
		});
	});
});

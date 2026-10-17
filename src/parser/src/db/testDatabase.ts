import { NodeServices } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import { Effect, Layer, Redacted } from "effect";
import { Reactivity } from "effect/reactivity";
import { runMigrations } from "./Database.ts";

/** A Postgres server where tests may create databases, such as the CI
 *  service. Without it the Postgres tests skip, except in CI, where a lost
 *  setting would otherwise leave the job green with the tests unrun. */
export const testDatabaseUrl = process.env["TEST_DATABASE_URL"];

if (testDatabaseUrl === undefined && process.env["CI"] !== undefined) {
	throw new Error("TEST_DATABASE_URL is required in CI");
}

/** A migrated database of its own for one test file, dropped afterwards. */
export const TestDatabase = (url: string) =>
	Layer.unwrap(
		Effect.gen(function* () {
			const name = `ukma_data_test_${crypto.randomUUID().replaceAll("-", "")}`;
			const admin = yield* PgClient.make({ url: Redacted.make(url) });

			yield* Effect.acquireRelease(admin`CREATE DATABASE ${admin(name)}`, () =>
				admin`DROP DATABASE ${admin(name)} WITH (FORCE)`.pipe(Effect.orDie),
			);

			const target = new URL(url);

			target.pathname = `/${name}`;

			return Layer.effectDiscard(runMigrations).pipe(
				Layer.provideMerge(
					PgClient.layer({ url: Redacted.make(target.toString()) }),
				),
				Layer.provide(NodeServices.layer),
			);
		}).pipe(Effect.provide(Reactivity.layer)),
	);

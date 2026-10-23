import { NodeServices } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import { Effect, Layer, Redacted } from "effect";
import { Reactivity } from "effect/reactivity";
import { runMigrations } from "./database.ts";

const url = process.env["TEST_DATABASE_URL"];

if (url === undefined) {
	throw new Error(
		"TEST_DATABASE_URL is missing: set it to a Postgres server where tests may create and drop databases, such as the docker compose Postgres in src as the postgres user (postgres://postgres:<password>@localhost:<port>/postgres)",
	);
}

/** A Postgres server where tests may create databases, such as the CI service. */
export const testDatabaseUrl: string = url;

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

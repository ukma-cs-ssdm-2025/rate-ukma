import { PgClient, PgMigrator } from "@effect/sql-pg";
import { Config, Effect } from "effect";
import Init from "./migrations/0001_init.ts";
import SazSnapshots from "./migrations/0002_saz_snapshots.ts";
import Offerings from "./migrations/0003_offerings.ts";
import Parses from "./migrations/0004_parses.ts";
import ChangeNumbers from "./migrations/0005_change_numbers.ts";
import Keys from "./migrations/0006_keys.ts";
import Students from "./migrations/0007_students.ts";

export const PgLive = PgClient.layerConfig({
	url: Config.Redacted("DATABASE_URL"),
});

export const runMigrations = PgMigrator.run({
	loader: PgMigrator.fromRecord({
		"0001_init": Init,
		"0002_saz_snapshots": SazSnapshots,
		"0003_offerings": Offerings,
		"0004_parses": Parses,
		"0005_change_numbers": ChangeNumbers,
		"0006_keys": Keys,
		"0007_students": Students,
	}),
}).pipe(
	Effect.tap((applied) =>
		Effect.logInfo(
			"Migrations applied",
			applied.map(([, name]) => name),
		),
	),
);

import { PgClient, PgMigrator } from "@effect/sql-pg";
import { Config, Effect } from "effect";
import Init from "./migrations/0001_init.ts";
import SazSnapshots from "./migrations/0002_saz_snapshots.ts";
import Offerings from "./migrations/0003_offerings.ts";

export const PgLive = PgClient.layerConfig({
	url: Config.Redacted("DATABASE_URL"),
});

/** Keyed `<number>_<name>`; the migrator skips a key without a number. */
export const migrations = {
	"0001_init": Init,
	"0002_saz_snapshots": SazSnapshots,
	"0003_offerings": Offerings,
};

export const runMigrations = PgMigrator.run({
	loader: PgMigrator.fromRecord(migrations),
}).pipe(
	Effect.tap((applied) =>
		Effect.logInfo(
			"Migrations applied",
			applied.map(([, name]) => name),
		),
	),
);

import { PgClient, PgMigrator } from "@effect/sql-pg";
import { Config, Effect } from "effect";
import Init from "./migrations/0001_init.ts";

export const PgLive = PgClient.layerConfig({
	url: Config.Redacted("DATABASE_URL"),
});

export const migrate = PgMigrator.run({
	loader: PgMigrator.fromRecord({ "0001_init": Init }),
}).pipe(
	Effect.tap((applied) =>
		Effect.logInfo(
			"Migrations applied",
			applied.map(([, name]) => name),
		),
	),
);

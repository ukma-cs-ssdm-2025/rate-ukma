import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { Command } from "effect/cli";
import { HttpServerLive } from "./api/http.ts";
import { ChangeLog } from "./changes/ChangeLog.ts";
import { PgLive, runMigrations } from "./db/Database.ts";
import { keyCommands } from "./keys/commands.ts";
import { parseOfferings } from "./offerings/offerings.ts";
import { OfferingStore } from "./offerings/OfferingStore.ts";
import { WorkerLive } from "./worker/Worker.ts";

const api = Command.make("api", {}, () =>
	Layer.launch(HttpServerLive.pipe(Layer.provide(PgLive))),
).pipe(Command.withDescription("Serve the HTTP API"));

const worker = Command.make("worker", {}, () =>
	Layer.launch(WorkerLive.pipe(Layer.provide(PgLive))),
).pipe(Command.withDescription("Run the background worker"));

const migrate = Command.make("migrate", {}, () =>
	runMigrations.pipe(Effect.provide(PgLive)),
).pipe(Command.withDescription("Apply database migrations"));

const reparse = Command.make("reparse", {}, () =>
	parseOfferings("reparse").pipe(
		Effect.provide(OfferingStore.layer.pipe(Layer.provide(ChangeLog.layer))),
		Effect.provide(PgLive),
	),
).pipe(
	Command.withDescription(
		"Rebuild the parsed tables from stored snapshots, with no request to САЗ",
	),
);

Command.make("ukma-data").pipe(
	Command.withSubcommands([api, worker, migrate, reparse, ...keyCommands]),
	Command.run({ version: "0.0.0" }),
	Effect.provide(NodeServices.layer),
	NodeRuntime.runMain,
);

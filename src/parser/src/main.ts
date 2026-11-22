import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { Command } from "effect/cli";
import { HttpServerLive } from "./api/http.ts";
import { ChangeLog } from "./changes/ChangeLog.ts";
import { Audit } from "./audit/Audit.ts";
import { courseCommands } from "./courses/commands.ts";
import { CourseStore } from "./courses/CourseStore.ts";
import { CrawlStore } from "./crawl/CrawlStore.ts";
import { PgLive, runMigrations } from "./db/database.ts";
import { KeysLive, keyCommands } from "./keys/commands.ts";
import { ListReader } from "./lists/ListReader.ts";
import { reparseOfferings } from "./offerings/offerings.ts";
import { OfferingStore } from "./offerings/OfferingStore.ts";
import { crawlSmart } from "./smart/crawl.ts";
import { parseSmart } from "./smart/parse.ts";
import { SmartClient } from "./smart/SmartClient.ts";
import { OfferingTeacherStore } from "./smart/OfferingTeacherStore.ts";
import { SmartStore } from "./smart/SmartStore.ts";
import { caseCommands } from "./students/commands.ts";
import { StudentCaseStore } from "./students/StudentCaseStore.ts";
import { parseStudents } from "./students/students.ts";
import { StudentStore } from "./students/StudentStore.ts";
import { TelemetryLive } from "./telemetry/telemetry.ts";
import { WorkerLive } from "./worker/Worker.ts";

const api = Command.make("api", {}, () =>
	Layer.launch(
		HttpServerLive.pipe(
			Layer.provide(PgLive),
			Layer.provide(TelemetryLive("parser-api")),
		),
	),
).pipe(Command.withDescription("Serve the HTTP API"));

const worker = Command.make("worker", {}, () =>
	Layer.launch(
		WorkerLive.pipe(
			Layer.provide(PgLive),
			Layer.provide(TelemetryLive("parser-worker")),
		),
	),
).pipe(Command.withDescription("Run the background worker"));

const migrate = Command.make("migrate", {}, () =>
	runMigrations.pipe(Effect.provide(PgLive)),
).pipe(Command.withDescription("Apply database migrations"));

const reparse = Command.make("reparse", {}, () =>
	reparseOfferings.pipe(
		Effect.andThen(parseStudents("reparse")),
		Effect.andThen(parseSmart("reparse")),
		Effect.provide(
			Layer.mergeAll(
				CourseStore.layer,
				OfferingStore.layer,
				OfferingTeacherStore.layer,
				SmartStore.layer,
				StudentStore.layer,
			).pipe(Layer.provideMerge(ChangeLog.layer)),
		),
		Effect.provide(PgLive),
		Effect.provide(TelemetryLive("parser-cli")),
	),
).pipe(
	Command.withDescription(
		"Rebuild the parsed tables from stored snapshots, with no request to САЗ",
	),
);

const crawlSmartCommand = Command.make("crawl-smart", {}, () =>
	crawlSmart().pipe(
		Effect.provide([CrawlStore.layer, SmartClient.layer]),
		Effect.provide(PgLive),
		Effect.provide(TelemetryLive("parser-cli")),
	),
).pipe(Command.withDescription("Store the smart.ukma lists once"));

/** The services behind `cases` and `courses`: the same ones the API's
 *  review handlers use, on the database of `DATABASE_URL`. */
const DecisionsLive = Layer.mergeAll(
	ListReader.layer,
	StudentCaseStore.layer,
	CourseStore.layer,
).pipe(
	Layer.provideMerge(Layer.mergeAll(ChangeLog.layer, Audit.layer)),
	Layer.provide(PgLive),
	Layer.provideMerge(TelemetryLive("parser-cli")),
);

Command.make("ukma-data").pipe(
	Command.withSubcommands([
		api,
		worker,
		migrate,
		reparse,
		crawlSmartCommand,
		...keyCommands(
			KeysLive.pipe(Layer.provideMerge(TelemetryLive("parser-cli"))),
		),
		caseCommands(DecisionsLive),
		courseCommands(DecisionsLive),
	]),
	Command.run({ version: "0.0.0" }),
	Effect.provide(NodeServices.layer),
	NodeRuntime.runMain,
);

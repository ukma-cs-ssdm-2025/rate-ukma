import { NodeServices } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import { Command } from "effect/cli";
import { SqlClient } from "effect/sql";
import { TestConsole } from "effect/testing";
import { Audit } from "../audit/Audit.ts";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { TestDatabase, testDatabaseUrl } from "../db/testing.ts";
import { ListReader } from "../lists/ListReader.ts";
import { reset } from "../offerings/testing.ts";
import { studentEntry, studentsPage } from "../saz/studentsPage.fixture.ts";
import { caseCommands } from "./commands.ts";
import { StudentCaseStore } from "./StudentCaseStore.ts";

const Services = Layer.mergeAll(ListReader.layer, StudentCaseStore.layer).pipe(
	Layer.provideMerge(Layer.mergeAll(ChangeLog.layer, Audit.layer)),
);

const cli = Command.make("ukma-data").pipe(
	Command.withSubcommands([caseCommands(Services)]),
);

/** Runs one command line and returns its exit and what it printed. */
const run = (args: ReadonlyArray<string>) =>
	Effect.gen(function* () {
		const exit = yield* Effect.exit(
			Command.runWith(cli, { version: "0.0.0" })(args),
		);

		const lines = (yield* TestConsole.logLines).map(String);
		const errors = (yield* TestConsole.errorLines).map(String);

		return { exit, lines, errors };
	}).pipe(Effect.provide(TestConsole.layer));

const statusOf = Effect.fnUntraced(function* (id: string) {
	const sql = yield* SqlClient.SqlClient;

	const [row] = yield* sql<{ readonly status: string }>`
		SELECT status FROM review_cases WHERE id = ${id}
	`;

	return row?.status;
});

const auditRows = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	return yield* sql<{
		readonly keyId: string | null;
		readonly targetId: string;
	}>`
		SELECT key_id AS "keyId", target_id AS "targetId" FROM audit_log
		WHERE action = 'student_case_decided'
	`;
});

/** One invented student with two programme records, a `student_match` case
 *  on the newer one, and a held-removals case. */
const setUp = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const changes = yield* ChangeLog;
	const next = sql`nextval('change_no_seq')`;

	yield* reset;

	yield* changes.withTurn(
		Effect.gen(function* () {
			yield* sql`INSERT INTO runs (source_part) VALUES ('test')`;

			const pages = [
				["older", 600301, "Вигаданенко Марта Ігорівна", 2],
				["newer", 600302, "Зразківська Марта Ігорівна", 1],
			] as const;

			for (const [label, cdoc, name, grade] of pages) {
				yield* sql`
					INSERT INTO page_snapshots (path, kind, content_hash, content, run_id)
					SELECT ${`/students/${label}`}, 'students', ${label},
						${studentsPage(studentEntry({ cdoc, name, grade }))}, id
					FROM runs LIMIT 1
				`;
			}

			yield* sql`
				INSERT INTO students (id, full_name, snapshot_id, change_no)
				SELECT 'stu_cli', 'Зразківська Марта Ігорівна', id, ${next}
				FROM page_snapshots WHERE path = '/students/newer'
			`;

			for (const [id, cdoc, label] of [
				["spr_cli_older", "600301", "older"],
				["spr_cli_newer", "600302", "newer"],
			] as const) {
				yield* sql`
					INSERT INTO student_programmes (
						id, saz_cdoc, student_id, spec_name, snapshot_id, change_no
					)
					SELECT ${id}, ${cdoc}, 'stu_cli', 'Вигадана інженерія', id, ${next}
					FROM page_snapshots WHERE path = ${`/students/${label}`}
				`;
			}

			yield* sql`
				INSERT INTO review_cases (
					id, kind, subject_id, candidates, safe_answer, run_id, change_no
				)
				VALUES
					('rev_cli', 'student_match', 'spr_cli_newer',
						'{"studentIds": ["stu_cli"]}', '{"studentId": "stu_cli"}',
						NULL, ${next}),
					('rev_held', 'removals_held', 'run_1',
						'{"academicYear": 2031, "offeringIds": ["off_a", "off_b", "off_c"]}',
						'{"removals": "held"}', 1, ${next})
			`;
		}),
	);
});

const TestLive = Services.pipe(
	Layer.provideMerge(NodeServices.layer),
	Layer.provideMerge(TestDatabase(testDatabaseUrl)),
);

describe("case commands", () => {
	layer(TestLive, { timeout: 30_000, excludeTestServices: true })((it) => {
		it.effect(
			"list prints one line per case, filtered by kind and status",
			() =>
				Effect.gen(function* () {
					yield* setUp;

					const all = yield* run(["cases", "list"]);

					assert.isTrue(Exit.isSuccess(all.exit));
					assert.lengthOf(all.lines, 3);
					assert.match(
						all.lines[0] ?? "",
						/^rev_cli\tstudent_match\topen\topened (just now|\d+ minutes? ago)\tcandidates 1$/,
					);
					assert.match(
						all.lines[1] ?? "",
						/^rev_held\tremovals_held\topen\t.*\tcandidates 3$/,
					);
					assert.strictEqual(all.lines[2], "2 cases");

					const held = yield* run(["cases", "list", "--kind", "removals_held"]);

					assert.deepStrictEqual(
						held.lines.map((line) => line.split("\t")[0]),
						["rev_held", "1 case"],
					);

					const decided = yield* run(["cases", "list", "--status", "decided"]);

					assert.deepStrictEqual(decided.lines, ["0 cases"]);
				}),
		);

		it.effect("show prints the record and its candidates", () =>
			Effect.gen(function* () {
				yield* setUp;

				const { exit, lines } = yield* run(["cases", "show", "rev_cli"]);

				assert.isTrue(Exit.isSuccess(exit));
				assert.match(lines[0] ?? "", /^rev_cli\tstudent_match\topen\topened /);
				assert.deepStrictEqual(lines.slice(1), [
					"record:\tstudent stu_cli\trecord spr_cli_newer\tЗразківська Марта Ігорівна\tВигадана інженерія\tyear 1\tactive",
					"joined student (safe answer):\tstu_cli",
					"candidates (1):",
					"\tstudent stu_cli\trecord spr_cli_older\tВигаданенко Марта Ігорівна\tВигадана інженерія\tyear 2\tactive",
				]);
			}),
		);

		it.effect("decide without --yes prints the change and writes nothing", () =>
			Effect.gen(function* () {
				yield* setUp;

				const { exit, lines } = yield* run([
					"cases",
					"decide",
					"rev_cli",
					"same_person",
				]);

				assert.isTrue(Exit.isSuccess(exit));
				assert.deepStrictEqual(lines.slice(-7), [
					"Would change:",
					"\tcase rev_cli: status open -> decided",
					"\trecord spr_cli_newer: stays with student stu_cli; no student or record changes",
					"\taudit: student_case_decided, recorded with no key, as the command line",
					"Rows written:",
					"\treview_cases: 1 change",
					"Dry run: nothing written. Add --yes to apply.",
				]);
				assert.strictEqual(yield* statusOf("rev_cli"), "open");
				assert.deepStrictEqual(yield* auditRows, []);
			}),
		);

		it.effect("decide --yes closes the case once, then refuses", () =>
			Effect.gen(function* () {
				yield* setUp;

				const first = yield* run([
					"cases",
					"decide",
					"rev_cli",
					"same_person",
					"--yes",
				]);

				assert.isTrue(Exit.isSuccess(first.exit));
				assert.include(first.lines, "Wrote:");
				assert.strictEqual(yield* statusOf("rev_cli"), "decided");
				assert.deepStrictEqual(yield* auditRows, [
					{ keyId: null, targetId: "rev_cli" },
				]);

				const failures = [
					[
						["cases", "decide", "rev_cli", "same_person", "--yes"],
						"Refused (not_open): case rev_cli is already decided or obsolete",
					],
					[
						["cases", "decide", "rev_cli", "same_person"],
						"Refused (not_open): case rev_cli is already decided or obsolete",
					],
					[
						["cases", "show", "rev_held"],
						"Refused (not_student_match): case rev_held is not a student_match case; only those can be shown or decided here",
					],
					[["cases", "show", "rev_missing"], "No review case rev_missing"],
				] as const;

				for (const [args, line] of failures) {
					const { exit, errors } = yield* run(args);

					assert.isTrue(Exit.isFailure(exit));
					assert.deepStrictEqual(errors, [line]);
				}

				assert.lengthOf(yield* auditRows, 1);
			}),
		);
	});
});

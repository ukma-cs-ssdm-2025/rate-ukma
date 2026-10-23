import { assert, describe, layer } from "@effect/vitest";
import { Effect, Layer, Redacted } from "effect";
import { HttpClientRequest, HttpServer } from "effect/http";
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api";
import { SqlClient } from "effect/sql";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { TestDatabase, testDatabaseUrl } from "../db/testing.ts";
import { Keys } from "../keys/Keys.ts";
import type { Scope } from "../keys/scopes.ts";
import { ListReader } from "../lists/ListReader.ts";
import { Api, ApiKeyAuth } from "./Api.ts";
import { AuthLive, CatalogApiHandlers, ReviewApiHandlers } from "./http.ts";

const FROM_START = { after: 0, limit: 500 };

const FINISHED_AT = new Date("2031-09-01T10:00:00Z");

/** Invented catalog rows: three offerings, the second one removed after the
 *  third was added, so it comes last. */
const seedRows = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const next = sql`nextval('change_no_seq')`;

	const [run] = yield* sql<{ readonly id: bigint }>`
		INSERT INTO runs (source_part, status, finished_at)
		VALUES ('saz-courses:2031-32', 'succeeded', ${FINISHED_AT})
		RETURNING id
	`;

	const [snapshot] = yield* sql<{ readonly id: bigint }>`
		INSERT INTO page_snapshots (path, kind, content_hash, content, run_id)
		VALUES ('/course/930001', 'course', 'hash', '<html></html>', ${run?.id ?? 0n})
		RETURNING id
	`;

	yield* sql`
		INSERT INTO terms (id, code, academic_year, season, change_no)
		VALUES ('trm_fall', '2031-32-FALL', 2031, 'FALL', ${next})
	`;
	yield* sql`
		INSERT INTO faculties (id, name, change_no)
		VALUES ('fac_one', 'Факультет уявних наук', ${next})
	`;
	yield* sql`
		INSERT INTO departments (id, name, faculty_id, change_no)
		VALUES ('dep_one', 'Кафедра вигаданих систем', 'fac_one', ${next})
	`;
	yield* sql`
		INSERT INTO programmes (id, name, level, change_no)
		VALUES ('prg_one', 'Уявна інженерія', 'bachelor', ${next})
	`;

	for (const code of ["930001", "930002", "930003"]) {
		yield* sql`
			INSERT INTO offerings (
				id, saz_code, academic_year, title, faculty_id, department_id, level,
				format, credits, hours, study_year, status, is_practical, saz_teachers,
				group_size_min, group_size_max, snapshot_id, change_no
			)
			VALUES (
				${`off_${code}`}, ${code}, 2031, ${`Вигаданий курс ${code}`}, 'fac_one',
				'dep_one', 'bachelor', '2015', 4.5, 135, 2, 'held', false,
				'Викладач Вигаданий', 10, 20, ${snapshot?.id ?? 0n}, ${next}
			)
		`;
	}

	yield* sql`
		INSERT INTO offering_terms (offering_id, term_id, semesters, credits, control)
		VALUES ('off_930001', 'trm_fall', '{1, 2}', 4.5, 'exam')
	`;
	yield* sql`
		INSERT INTO offering_programmes (offering_id, programme_id, kind)
		VALUES ('off_930001', 'prg_one', 'elective')
	`;
	yield* sql`
		UPDATE offerings
		SET removed_at = '2031-09-02T00:00:00Z', change_no = ${next}
		WHERE id = 'off_930002'
	`;
});

const seed = Effect.gen(function* () {
	const changes = yield* ChangeLog;

	yield* changes.withTurn(seedRows);
});

const TestLive = Layer.mergeAll(CatalogApiHandlers, ReviewApiHandlers).pipe(
	Layer.provideMerge(Layer.mergeAll(ListReader.layer, AuthLive)),
	Layer.provideMerge(HttpServer.layerServices),
	Layer.provideMerge(Layer.effectDiscard(seed)),
	Layer.provideMerge(ChangeLog.layer),
	Layer.provideMerge(TestDatabase(testDatabaseUrl)),
);

const clientAs = (scopes: ReadonlyArray<Scope>) =>
	Effect.gen(function* () {
		const keys = yield* Keys;

		const key = yield* keys.create({
			name: "test reader",
			scopes,
			expiresInDays: 30,
			createdBy: null,
		});

		const client = yield* HttpApiTest.groups(Api, ["catalog", "review"]).pipe(
			Effect.provide(
				HttpApiMiddleware.layerClient(ApiKeyAuth, ({ next, request }) =>
					next(
						HttpClientRequest.bearerToken(request, Redacted.value(key.token)),
					),
				),
			),
		);

		return { client, keyId: key.id };
	});

describe.skipIf(testDatabaseUrl === undefined)("list endpoints", () => {
	layer(TestLive, { timeout: 30_000, excludeTestServices: true })((it) => {
		it.effect(
			"syncs offerings page by page in change-number order, removed rows included",
			() =>
				Effect.gen(function* () {
					const { client } = yield* clientAs(["catalog:read"]);

					const first = yield* client.catalog.offerings({
						query: { after: 0, limit: 2 },
					});

					const second = yield* client.catalog.offerings({
						query: { after: first.cursor, limit: 2 },
					});

					const last = yield* client.catalog.offerings({
						query: { after: second.cursor, limit: 2 },
					});

					assert.deepStrictEqual(
						[...first.items, ...second.items].map(({ id, removedAt }) => [
							id,
							removedAt?.toISOString() ?? null,
						]),
						[
							["off_930001", null],
							["off_930003", null],
							["off_930002", "2031-09-02T00:00:00.000Z"],
						],
					);
					assert.isTrue(first.hasMore);
					assert.isFalse(second.hasMore);
					assert.strictEqual(second.cursor, second.items.at(-1)?.changeNo);
					assert.deepStrictEqual(last.items, []);
					assert.strictEqual(last.cursor, second.cursor);
					assert.deepStrictEqual(first.dataUpdatedAt, FINISHED_AT);

					const [offering] = first.items;

					assert.deepStrictEqual(offering?.terms, [
						{
							termId: "trm_fall",
							semesters: [1, 2],
							credits: 4.5,
							hoursPerWeek: null,
							lectureHours: null,
							seminarHours: null,
							practiceHours: null,
							control: "exam",
						},
					]);
					assert.deepStrictEqual(offering?.programmes, [
						{ programmeId: "prg_one", kind: "elective" },
					]);
					assert.strictEqual(offering?.credits, 4.5);
					assert.notProperty(offering, "sazTeachers");
				}),
		);

		it.effect("serves each reference list above the saved number", () =>
			Effect.gen(function* () {
				const { client } = yield* clientAs(["catalog:read"]);

				const terms = yield* client.catalog.terms({ query: FROM_START });

				const faculties = yield* client.catalog.faculties({
					query: { ...FROM_START, after: terms.cursor },
				});

				const departments = yield* client.catalog.departments({
					query: FROM_START,
				});

				const programmes = yield* client.catalog.programmes({
					query: FROM_START,
				});

				assert.deepStrictEqual(
					terms.items.map(({ code }) => code),
					["2031-32-FALL"],
				);
				assert.deepStrictEqual(
					faculties.items.map(({ id }) => id),
					["fac_one"],
				);
				assert.strictEqual(departments.items[0]?.facultyId, "fac_one");
				assert.strictEqual(programmes.items[0]?.level, "bachelor");
			}),
		);

		it.effect(
			"needs review:decide for review cases and audits the row count",
			() =>
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const changes = yield* ChangeLog;

					yield* changes.withTurn(sql`
						INSERT INTO review_cases (
							kind, subject_id, candidates, safe_answer, run_id, change_no
						)
						SELECT 'removals_held', 'run_' || id,
							'{"offeringIds": ["off_930001"]}', '{"removals": "held"}', id,
							nextval('change_no_seq')
						FROM runs
					`);

					const catalog = yield* clientAs(["catalog:read"]);

					const error = yield* Effect.flip(
						catalog.client.review.reviewCases({ query: FROM_START }),
					);

					assert.strictEqual(error._tag, "Forbidden");

					const reviewer = yield* clientAs(["review:decide"]);

					const page = yield* reviewer.client.review.reviewCases({
						query: FROM_START,
					});

					assert.deepStrictEqual(
						page.items.map(({ kind, candidates, runId }) => ({
							kind,
							candidates,
							runId: runId?.startsWith("run_"),
						})),
						[
							{
								kind: "removals_held",
								candidates: { offeringIds: ["off_930001"] },
								runId: true,
							},
						],
					);

					const audit = yield* sql<{
						readonly route: string;
						readonly rowCount: number;
					}>`
						SELECT route, row_count AS "rowCount" FROM audit_log
						WHERE key_id = ${reviewer.keyId} AND action = 'request'
					`;

					assert.deepStrictEqual(audit, [
						{ route: "GET /v1/review-cases", rowCount: 1 },
					]);
				}),
		);
	});
});

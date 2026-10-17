import { assert, describe, layer } from "@effect/vitest";
import { Effect, Layer, Predicate } from "effect";
import { SqlClient } from "effect/sql";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { TestDatabase, testDatabaseUrl } from "../db/testDatabase.ts";
import { parseOfferings } from "../offerings/offerings.ts";
import { OfferingStore } from "../offerings/OfferingStore.ts";
import { coursePage } from "../saz/coursePage.fixture.ts";
import { studentEntry, studentsPage } from "../saz/studentsPage.fixture.ts";
import { parseStudents } from "./students.ts";
import { StudentStore } from "./StudentStore.ts";

const TestLive = Layer.mergeAll(OfferingStore.layer, StudentStore.layer).pipe(
	Layer.provideMerge(ChangeLog.layer),
	Layer.provideMerge(TestDatabase(testDatabaseUrl ?? "")),
);

/** Stores a page as a crawl does, in a run of its own. */
const store = (path: string, kind: "course" | "students", content: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		yield* sql`
			WITH run AS (INSERT INTO runs (source_part) VALUES ('test') RETURNING id)
			INSERT INTO page_snapshots (path, kind, content_hash, content, run_id)
			SELECT ${path}, ${kind}, ${`hash ${content.length}`}, ${content}, id FROM run
		`;
	});

type Card = NonNullable<Parameters<typeof coursePage>[0]>;

/** Offerings parsed from these course pages; a code alone is the fixture's. */
const offerings = (...cards: ReadonlyArray<string | Card>) =>
	Effect.gen(function* () {
		for (const card of cards) {
			const parts = Predicate.isString(card) ? { code: card } : card;

			yield* store(`/course/${parts.code}`, "course", coursePage(parts));
		}

		yield* parseOfferings("crawl");
	});

const list = (code: string, content: string) =>
	store(`/course/${code}/students`, "students", content);

interface Listed {
	readonly cdoc: string;
	readonly changeNo: bigint;
	readonly removed: boolean;
}

const enrollmentsOf = (code: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		return yield* sql<Listed>`
			SELECT sp.saz_cdoc AS cdoc, e.change_no AS "changeNo",
				e.removed_at IS NOT NULL AS removed
			FROM enrollments e
			JOIN offerings o ON o.id = e.offering_id
			JOIN student_programmes sp ON sp.id = e.student_programme_id
			WHERE o.saz_code = ${code}
			ORDER BY sp.saz_cdoc
		`;
	});

interface Person {
	readonly cdoc: string;
	readonly email: string | null;
	readonly fullName: string;
	readonly removed: boolean;
}

const programmeOf = (cdoc: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const [record] = yield* sql<{ readonly level: string | null }>`
			SELECT p.level FROM student_programmes sp
			LEFT JOIN programmes p ON p.id = sp.programme_id
			WHERE sp.saz_cdoc = ${cdoc}
		`;

		return record?.level;
	});

const personOf = (cdoc: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const [person] = yield* sql<Person>`
			SELECT sp.saz_cdoc AS cdoc, s.email, s.full_name AS "fullName",
				s.removed_at IS NOT NULL AS removed
			FROM student_programmes sp JOIN students s ON s.id = sp.student_id
			WHERE sp.saz_cdoc = ${cdoc}
		`;

		return person;
	});

describe.skipIf(testDatabaseUrl === undefined)("student tracking", () => {
	layer(TestLive, { timeout: 30_000, excludeTestServices: true })((it) => {
		it.effect("numbers each row once, so a second parse takes no number", () =>
			Effect.gen(function* () {
				yield* offerings("981001", "981002");
				yield* list(
					"981001",
					studentsPage(
						studentEntry({ cdoc: 610001, email: "A.Zrazok@Example.edu" }),
						studentEntry({
							cdoc: 610002,
							name: "Приклад  Ігор Васильович",
							email: "",
						}),
					),
				);
				// One person on two programmes, both on one list (D2).
				yield* list(
					"981002",
					studentsPage(
						studentEntry({ cdoc: 610001, email: "a.zrazok@example.edu" }),
						studentEntry({
							cdoc: 610003,
							email: "a.zrazok@example.edu",
							specName: "Вигадана економіка",
						}),
					),
				);

				const first = yield* parseStudents("crawl");

				assert.deepInclude(first, {
					parsed: 2,
					failed: [],
					listsEmptied: 0,
					listsKept: 0,
				});
				assert.sameDeepMembers(
					[...first.changes],
					[
						{ table: "students", action: "add", rows: 2 },
						{ table: "student_programmes", action: "add", rows: 3 },
						{ table: "enrollments", action: "add", rows: 4 },
					],
				);
				assert.deepStrictEqual(yield* personOf("610001"), {
					cdoc: "610001",
					email: "a.zrazok@example.edu",
					fullName: "Зразок Олена Петрівна",
					removed: false,
				});
				assert.deepStrictEqual(yield* personOf("610002"), {
					cdoc: "610002",
					email: null,
					fullName: "Приклад Ігор Васильович",
					removed: false,
				});

				const before = yield* enrollmentsOf("981002");
				const skipped = yield* parseStudents("crawl");
				const again = yield* parseStudents("reparse");

				assert.deepInclude(skipped, { parsed: 0, changes: [] });
				assert.deepInclude(again, { parsed: 2, changes: [] });
				assert.deepStrictEqual(yield* enrollmentsOf("981002"), before);
			}),
		);

		it.effect(
			"keeps the enrollments of a page that fails and empties a list on `[]`",
			() =>
				Effect.gen(function* () {
					yield* offerings("982001", "982002");
					yield* list(
						"982001",
						studentsPage(
							studentEntry({ cdoc: 620001, email: "b.zrazok@example.edu" }),
						),
					);
					yield* list(
						"982002",
						studentsPage(
							studentEntry({ cdoc: 620001, email: "b.zrazok@example.edu" }),
							studentEntry({ cdoc: 620002, email: "b.pryklad@example.edu" }),
						),
					);
					yield* parseStudents("crawl");

					const kept = yield* enrollmentsOf("982001");

					yield* list("982001", "<html>");
					yield* list("982002", "[]");

					const report = yield* parseStudents("crawl");

					assert.deepInclude(report, {
						parsed: 1,
						failed: [{ reason: "invalid page", pages: 1 }],
						listsEmptied: 1,
						listsKept: 1,
					});
					assert.deepStrictEqual(yield* enrollmentsOf("982001"), kept);
					assert.deepStrictEqual(
						(yield* enrollmentsOf("982002")).map(({ removed }) => removed),
						[true, true],
					);
					// The person left on no list is removed; the other keeps 982001.
					assert.isTrue((yield* personOf("620002"))?.removed);
					assert.isFalse((yield* personOf("620001"))?.removed);

					// The failed page is tried again by the next crawl.
					assert.deepInclude(yield* parseStudents("crawl"), {
						parsed: 0,
						listsKept: 1,
					});
				}),
		);

		it.effect(
			"moves a record to the student of its new email and restores a returning enrollment",
			() =>
				Effect.gen(function* () {
					yield* offerings("983001");
					yield* list(
						"983001",
						studentsPage(
							studentEntry({ cdoc: 630001, email: "" }),
							studentEntry({ cdoc: 630002, email: "c.pryklad@example.edu" }),
						),
					);
					yield* parseStudents("crawl");

					const listed = yield* enrollmentsOf("983001");

					yield* list(
						"983001",
						studentsPage(
							studentEntry({
								cdoc: 630001,
								email: "c.zrazok@example.edu",
								name: "Зр*зок Олена Петрівна",
							}),
						),
					);

					const moved = yield* parseStudents("crawl");

					assert.sameDeepMembers(
						[...moved.changes],
						[
							{ table: "students", action: "add", rows: 1 },
							{ table: "student_programmes", action: "change", rows: 1 },
							{ table: "student_programmes", action: "remove", rows: 1 },
							{ table: "students", action: "remove", rows: 2 },
							{ table: "enrollments", action: "remove", rows: 1 },
						],
					);
					// A name with `*` is new here, so nothing older keeps it (D6).
					assert.deepStrictEqual(yield* personOf("630001"), {
						cdoc: "630001",
						email: "c.zrazok@example.edu",
						fullName: "Зр*зок Олена Петрівна",
						removed: false,
					});
					assert.isTrue((yield* personOf("630002"))?.removed);

					yield* list(
						"983001",
						studentsPage(
							studentEntry({ cdoc: 630001, email: "c.zrazok@example.edu" }),
							studentEntry({ cdoc: 630002, email: "c.pryklad@example.edu" }),
						),
					);

					const restored = yield* parseStudents("crawl");
					const after = yield* enrollmentsOf("983001");

					assert.sameDeepMembers(
						[...restored.changes],
						[
							{ table: "students", action: "change", rows: 1 },
							{ table: "enrollments", action: "restore", rows: 1 },
							{ table: "student_programmes", action: "restore", rows: 1 },
							{ table: "students", action: "restore", rows: 1 },
						],
					);
					assert.strictEqual(
						(yield* personOf("630001"))?.fullName,
						"Зразок Олена Петрівна",
					);
					assert.isFalse(after[1]?.removed);
					assert.isAbove(
						Number(after[1]?.changeNo),
						Number(listed[1]?.changeNo),
					);
				}),
		);

		it.effect(
			"keeps a person whole when a newer list of the batch drops the email (D3)",
			() =>
				Effect.gen(function* () {
					yield* offerings("984001", "984002");
					yield* list(
						"984001",
						studentsPage(
							studentEntry({ cdoc: 640001, email: "d.zrazok@example.edu" }),
						),
					);
					yield* list(
						"984002",
						studentsPage(studentEntry({ cdoc: 640001, email: "" })),
					);

					const report = yield* parseStudents("crawl");

					assert.sameDeepMembers(
						[...report.changes],
						[
							{ table: "students", action: "add", rows: 1 },
							{ table: "student_programmes", action: "add", rows: 1 },
							{ table: "enrollments", action: "add", rows: 2 },
						],
					);
					assert.strictEqual(
						(yield* personOf("640001"))?.email,
						"d.zrazok@example.edu",
					);
				}),
		);

		it.effect(
			"links a record to the programme of the level its cards give (D12)",
			() =>
				Effect.gen(function* () {
					const physics: Card["programmes"] = [
						["Вигадана фізика", "Обов`язкова"],
					];

					yield* offerings(
						{ code: "985001", programmes: physics },
						{ code: "985002", programmes: physics, level: "Магістр" },
					);

					const physicist = (cdoc: number) =>
						studentEntry({
							cdoc,
							email: `${cdoc}@example.edu`,
							specName: "Вигадана фізика",
						});

					yield* list(
						"985001",
						studentsPage(physicist(650001), physicist(650003)),
					);
					yield* list(
						"985002",
						studentsPage(physicist(650002), physicist(650003)),
					);
					yield* parseStudents("crawl");

					assert.strictEqual(yield* programmeOf("650001"), "bachelor");
					assert.strictEqual(yield* programmeOf("650002"), "master");
					assert.isNull(yield* programmeOf("650003"));
				}),
		);

		it.effect(
			"keeps a stored name over a later one with `*` and a list applied from a newer page",
			() =>
				Effect.gen(function* () {
					const students = yield* StudentStore;

					yield* offerings("986001", "986002");
					yield* list(
						"986001",
						studentsPage(
							studentEntry({ cdoc: 660001, email: "e.zrazok@example.edu" }),
						),
					);
					yield* parseStudents("crawl");
					yield* list(
						"986002",
						studentsPage(
							studentEntry({
								cdoc: 660001,
								email: "e.zrazok@example.edu",
								name: "Зр*зок Олена Петрівна",
							}),
						),
					);

					const starred = yield* parseStudents("crawl");

					assert.deepStrictEqual(starred.changes, [
						{ table: "enrollments", action: "add", rows: 1 },
					]);
					assert.strictEqual(
						(yield* personOf("660001"))?.fullName,
						"Зразок Олена Петрівна",
					);

					const before = yield* enrollmentsOf("986001");
					const parseId = yield* (yield* OfferingStore).startParse("reparse");

					const older = yield* students.write(
						[{ snapshotId: 1n, sazCode: "986001", entries: [] }],
						parseId,
					);

					assert.deepStrictEqual(older, {
						changes: [],
						parsed: 0,
						emptied: [],
					});
					assert.deepStrictEqual(yield* enrollmentsOf("986001"), before);
				}),
		);
	});
});

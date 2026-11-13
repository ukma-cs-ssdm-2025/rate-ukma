import { assert, describe, layer } from "@effect/vitest";
import { Cause, Effect, Layer, Predicate } from "effect";
import { SqlClient } from "effect/sql";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { TestDatabase, testDatabaseUrl } from "../db/testing.ts";
import { parseOfferings } from "../offerings/offerings.ts";
import { OfferingStore } from "../offerings/OfferingStore.ts";
import { coursePage } from "../saz/coursePage.fixture.ts";
import { studentEntry, studentsPage } from "../saz/studentsPage.fixture.ts";
import { parseStudents } from "./students.ts";
import { StudentStore } from "./StudentStore.ts";

const TestLive = Layer.mergeAll(OfferingStore.layer, StudentStore.layer).pipe(
	Layer.provideMerge(ChangeLog.layer),
	Layer.provideMerge(TestDatabase(testDatabaseUrl)),
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

const studentIdOf = (cdoc: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		const [record] = yield* sql<{ readonly studentId: string }>`
			SELECT student_id AS "studentId" FROM student_programmes
			WHERE saz_cdoc = ${cdoc}
		`;

		return record?.studentId;
	});

interface Case {
	readonly status: string;
	readonly candidates: unknown;
	readonly safeAnswer: unknown;
}

const casesOf = (cdoc: string) =>
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;

		return yield* sql<Case>`
			SELECT rc.status, rc.candidates, rc.safe_answer AS "safeAnswer"
			FROM review_cases rc
			JOIN student_programmes sp ON sp.id = rc.subject_id
			WHERE rc.kind = 'student_match' AND sp.saz_cdoc = ${cdoc}
		`;
	});

describe("student tracking", () => {
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
					yield* offerings({ code: "982002", enrollment: [] });

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
			"keeps a list that empties while its card still shows enrollments",
			() =>
				Effect.gen(function* () {
					// Other tests' failed pages fail again on every crawl.
					const crawl = parseStudents("crawl").pipe(
						Effect.map(({ listsKept, listsEmptied, failed }) => ({
							emptied: listsEmptied,
							kept:
								listsKept - failed.reduce((sum, { pages }) => sum + pages, 0),
						})),
					);

					yield* offerings("997001");
					yield* list(
						"997001",
						studentsPage(
							studentEntry({ cdoc: 655001, email: "s.zrazok@example.edu" }),
						),
					);
					yield* parseStudents("crawl");

					const before = yield* enrollmentsOf("997001");

					yield* list("997001", "[]");

					assert.deepStrictEqual(yield* crawl, { emptied: 0, kept: 1 });
					assert.deepStrictEqual(yield* enrollmentsOf("997001"), before);

					// The next crawl tries the list again; once the card loses its
					// enrollment block too, the list applies.
					assert.deepStrictEqual(yield* crawl, { emptied: 0, kept: 1 });
					yield* offerings({ code: "997001", enrollment: [] });
					assert.deepStrictEqual(yield* crawl, { emptied: 1, kept: 0 });
					assert.isTrue((yield* personOf("655001"))?.removed);
				}),
		);

		it.effect(
			"keeps the enrollments of a batch the database rejects and records its lists",
			() =>
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;

					yield* offerings("987001");
					yield* list(
						"987001",
						studentsPage(
							studentEntry({ cdoc: 670001, email: "f.zrazok@example.edu" }),
						),
					);
					yield* parseStudents("crawl");

					const kept = yield* enrollmentsOf("987001");

					yield* list(
						"987001",
						studentsPage(
							studentEntry({ cdoc: 670001, email: "f.zrazok@example.edu" }),
							studentEntry({ cdoc: 670002, email: "f.pryklad@example.edu" }),
						),
					);
					yield* sql`
						CREATE FUNCTION reject_enrollment() RETURNS trigger LANGUAGE plpgsql
						AS $$ BEGIN RAISE EXCEPTION 'rejected'; END $$
					`;
					yield* sql`
						CREATE TRIGGER reject_enrollment BEFORE INSERT OR UPDATE ON enrollments
						FOR EACH ROW EXECUTE FUNCTION reject_enrollment()
					`;

					const report = yield* parseStudents("crawl").pipe(
						Effect.ensuring(
							sql`DROP FUNCTION reject_enrollment CASCADE`.pipe(Effect.orDie),
						),
					);

					const failures = yield* sql<{ readonly reason: string }>`
						SELECT reason FROM parse_failures
						WHERE path = '/course/987001/students'
							AND parse_id = (SELECT max(id) FROM parses)
					`;

					assert.deepInclude(report, { parsed: 0, changes: [] });
					assert.deepStrictEqual(failures, [{ reason: "store" }]);
					assert.deepStrictEqual(yield* enrollmentsOf("987001"), kept);
					assert.isUndefined(yield* personOf("670002"));

					// The list was not applied, so the next crawl applies it.
					assert.deepInclude(yield* parseStudents("crawl"), { parsed: 1 });
					assert.lengthOf(yield* enrollmentsOf("987001"), 2);
				}),
		);

		it.effect(
			"keeps a record's student when its email changes and restores a returning enrollment",
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
					const student = yield* studentIdOf("630001");

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

					const changed = yield* parseStudents("crawl");

					assert.sameDeepMembers(
						[...changed.changes],
						[
							{ table: "students", action: "change", rows: 1 },
							{ table: "student_programmes", action: "remove", rows: 1 },
							{ table: "students", action: "remove", rows: 1 },
							{ table: "enrollments", action: "remove", rows: 1 },
						],
					);
					// The student takes the email and keeps its name without `*` (D6).
					assert.strictEqual(yield* studentIdOf("630001"), student);
					assert.deepStrictEqual(yield* personOf("630001"), {
						cdoc: "630001",
						email: "c.zrazok@example.edu",
						fullName: "Зразок Олена Петрівна",
						removed: false,
					});
					assert.isTrue((yield* personOf("630002"))?.removed);

					yield* list(
						"983001",
						studentsPage(
							studentEntry({ cdoc: 630001, email: "c.novyi@example.edu" }),
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
					assert.strictEqual(yield* studentIdOf("630001"), student);
					assert.strictEqual(
						(yield* personOf("630001"))?.email,
						"c.novyi@example.edu",
					);
					assert.isFalse(after[1]?.removed);
					assert.isAbove(
						Number(after[1]?.changeNo),
						Number(listed[1]?.changeNo),
					);
				}),
		);

		it.effect(
			"keeps two people on one email apart when their first names differ (D14)",
			() =>
				Effect.gen(function* () {
					yield* offerings("988001", "988002");
					yield* list(
						"988001",
						studentsPage(
							studentEntry({ cdoc: 680001, email: "g.zrazok@example.edu" }),
							studentEntry({
								cdoc: 680003,
								email: "g.zrazok@example.edu",
								name: "Зразок Остап Іванович",
							}),
						),
					);

					const first = yield* parseStudents("crawl");

					assert.deepInclude(first.changes, {
						table: "students",
						action: "add",
						rows: 2,
					});
					assert.notStrictEqual(
						yield* studentIdOf("680001"),
						yield* studentIdOf("680003"),
					);

					yield* list(
						"988002",
						studentsPage(
							studentEntry({
								cdoc: 680002,
								email: "g.zrazok@example.edu",
								name: "Зразок Остап Іванович",
							}),
						),
					);

					const second = yield* parseStudents("crawl");

					// The new record joins the student of its first name, no case.
					assert.sameDeepMembers(
						[...second.changes],
						[
							{ table: "student_programmes", action: "add", rows: 1 },
							{ table: "enrollments", action: "add", rows: 1 },
						],
					);
					assert.strictEqual(
						yield* studentIdOf("680002"),
						yield* studentIdOf("680003"),
					);
					assert.strictEqual(
						(yield* personOf("680001"))?.fullName,
						"Зразок Олена Петрівна",
					);
					assert.strictEqual(
						(yield* personOf("680002"))?.fullName,
						"Зразок Остап Іванович",
					);
					assert.isEmpty(yield* casesOf("680002"));
				}),
		);

		it.effect(
			"joins a record whose surname differs and opens one case for it (D14)",
			() =>
				Effect.gen(function* () {
					yield* offerings("989001", "989002");
					yield* list(
						"989001",
						studentsPage(
							studentEntry({ cdoc: 681001, email: "h.zrazok@example.edu" }),
						),
					);
					yield* parseStudents("crawl");
					yield* list(
						"989002",
						studentsPage(
							studentEntry({
								cdoc: 681002,
								email: "h.zrazok@example.edu",
								name: "Приклад Олена Петрівна",
							}),
						),
					);

					const joined = yield* parseStudents("crawl");
					const student = yield* studentIdOf("681001");

					assert.strictEqual(yield* studentIdOf("681002"), student);
					assert.deepInclude(joined.changes, {
						table: "review_cases",
						action: "add",
						rows: 1,
					});
					assert.deepStrictEqual(yield* casesOf("681002"), [
						{
							status: "open",
							candidates: { studentIds: [student] },
							safeAnswer: { studentId: student },
						},
					]);
					// The latest list names the student.
					assert.strictEqual(
						(yield* personOf("681001"))?.fullName,
						"Приклад Олена Петрівна",
					);

					assert.deepInclude(yield* parseStudents("reparse"), { changes: [] });
					assert.lengthOf(yield* casesOf("681002"), 1);
				}),
		);

		it.effect(
			"starts a new student for a new record without an email (D3)",
			() =>
				Effect.gen(function* () {
					yield* offerings("990001", "990002");
					yield* list(
						"990001",
						studentsPage(
							studentEntry({ cdoc: 682001, email: "i.zrazok@example.edu" }),
						),
					);
					yield* parseStudents("crawl");
					yield* list(
						"990002",
						studentsPage(
							studentEntry({ cdoc: 682002, email: "" }),
							studentEntry({ cdoc: 682003, email: "" }),
						),
					);
					yield* parseStudents("crawl");

					const ids = [
						yield* studentIdOf("682001"),
						yield* studentIdOf("682002"),
						yield* studentIdOf("682003"),
					];

					assert.strictEqual(new Set(ids).size, 3);
					assert.isEmpty(yield* casesOf("682002"));
				}),
		);

		it.effect(
			"joins the match with the newest first enrollment and opens a case on a tie",
			() =>
				Effect.gen(function* () {
					yield* offerings("991001", "991002", "991003");
					yield* list(
						"991001",
						studentsPage(
							studentEntry({
								cdoc: 683001,
								email: "j.zrazok@example.edu",
								createdAt: 1_700_000_000,
							}),
							studentEntry({
								cdoc: 683002,
								email: "j.pryklad@example.edu",
								createdAt: 1_750_000_000,
							}),
						),
					);
					yield* parseStudents("crawl");
					// The second student takes the first one's email: two students now
					// share an email and a first name.
					yield* list(
						"991002",
						studentsPage(
							studentEntry({ cdoc: 683002, email: "j.zrazok@example.edu" }),
						),
					);
					yield* parseStudents("crawl");
					yield* list(
						"991003",
						studentsPage(
							studentEntry({ cdoc: 683003, email: "j.zrazok@example.edu" }),
						),
					);
					yield* parseStudents("crawl");

					const older = yield* studentIdOf("683001");
					const newer = yield* studentIdOf("683002");

					assert.notStrictEqual(older, newer);
					assert.strictEqual(yield* studentIdOf("683003"), newer);
					assert.deepStrictEqual(yield* casesOf("683003"), [
						{
							status: "open",
							candidates: { studentIds: [newer, older] },
							safeAnswer: { studentId: newer },
						},
					]);
				}),
		);

		it.effect(
			"names a student from the newest list when two of its records are in one batch",
			() =>
				Effect.gen(function* () {
					yield* offerings("992001", "992002", "992003");
					yield* list(
						"992001",
						studentsPage(
							studentEntry({ cdoc: 684001, email: "k.zrazok@example.edu" }),
							studentEntry({ cdoc: 684002, email: "k.zrazok@example.edu" }),
						),
					);
					yield* parseStudents("crawl");
					yield* list(
						"992002",
						studentsPage(
							studentEntry({
								cdoc: 684001,
								email: "k.zrazok@example.edu",
								name: "Приклад Олена Петрівна",
							}),
						),
					);
					yield* list(
						"992003",
						studentsPage(
							studentEntry({
								cdoc: 684002,
								email: "k.zrazok@example.edu",
								name: "Інша Олена Петрівна",
							}),
						),
					);
					yield* parseStudents("crawl");

					assert.strictEqual(
						yield* studentIdOf("684001"),
						yield* studentIdOf("684002"),
					);
					assert.strictEqual(
						(yield* personOf("684001"))?.fullName,
						"Інша Олена Петрівна",
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

					// The bachelor's list is older than the record now, yet its card
					// still counts.
					yield* parseStudents("reparse");

					assert.isNull(yield* programmeOf("650003"));
				}),
		);

		it.effect(
			"keeps a newer email when a reparse sees an older list with the old one",
			() =>
				Effect.gen(function* () {
					yield* offerings("993001", "993002");
					yield* list(
						"993001",
						studentsPage(
							studentEntry({ cdoc: 651001, email: "m.old@example.edu" }),
						),
					);
					yield* list(
						"993002",
						studentsPage(
							studentEntry({ cdoc: 651001, email: "m.new@example.edu" }),
						),
					);
					yield* parseStudents("crawl");
					yield* list(
						"993002",
						studentsPage(studentEntry({ cdoc: 651001, email: "" })),
					);
					yield* parseStudents("crawl");

					assert.strictEqual(
						(yield* personOf("651001"))?.email,
						"m.new@example.edu",
					);

					yield* parseStudents("reparse");

					assert.strictEqual(
						(yield* personOf("651001"))?.email,
						"m.new@example.edu",
					);
				}),
		);

		it.effect("renames a student from a newer list without an email", () =>
			Effect.gen(function* () {
				yield* offerings("994001");
				yield* list("994001", studentsPage(studentEntry({ cdoc: 652001 })));
				yield* parseStudents("crawl");
				yield* list(
					"994001",
					studentsPage(
						studentEntry({
							cdoc: 652001,
							name: "Приклад Олена Петрівна",
							email: "",
						}),
					),
				);
				yield* parseStudents("crawl");

				assert.deepInclude(yield* personOf("652001"), {
					email: "o.zrazok@example.edu",
					fullName: "Приклад Олена Петрівна",
				});
			}),
		);

		it.effect(
			"takes a clean name from an older record over a newer one with `*`",
			() =>
				Effect.gen(function* () {
					yield* offerings("995001", "995002");
					yield* list(
						"995001",
						studentsPage(
							studentEntry({ cdoc: 653001, email: "p.zrazok@example.edu" }),
							studentEntry({ cdoc: 653002, email: "p.zrazok@example.edu" }),
						),
					);
					yield* parseStudents("crawl");

					// One page renames the student cleanly, a newer one with `*`.
					yield* list(
						"995001",
						studentsPage(
							studentEntry({
								cdoc: 653001,
								name: "Приклад Олена Петрівна",
								email: "p.zrazok@example.edu",
							}),
						),
					);
					yield* list(
						"995002",
						studentsPage(
							studentEntry({
								cdoc: 653002,
								name: "Пр*клад Олена Петрівна",
								email: "p.zrazok@example.edu",
							}),
						),
					);
					yield* parseStudents("crawl");

					assert.strictEqual(
						(yield* personOf("653002"))?.fullName,
						"Приклад Олена Петрівна",
					);
				}),
		);

		it.effect(
			"keeps a student's newer details when a reparse sees an older sibling record",
			() =>
				Effect.gen(function* () {
					yield* offerings("996001", "996002");
					yield* list(
						"996001",
						studentsPage(
							studentEntry({ cdoc: 654001, email: "r.old@example.edu" }),
						),
					);
					yield* list(
						"996002",
						studentsPage(
							studentEntry({ cdoc: 654002, email: "r.old@example.edu" }),
						),
					);
					yield* parseStudents("crawl");

					// The second record renames the student, then shows `*` and no email.
					yield* list(
						"996002",
						studentsPage(
							studentEntry({
								cdoc: 654002,
								name: "Приклад Олена Петрівна",
								email: "r.new@example.edu",
							}),
						),
					);
					yield* parseStudents("crawl");
					yield* list(
						"996002",
						studentsPage(
							studentEntry({
								cdoc: 654002,
								name: "Пр*клад Олена Петрівна",
								email: "",
							}),
						),
					);
					yield* parseStudents("crawl");
					yield* parseStudents("reparse");

					assert.deepInclude(yield* personOf("654001"), {
						email: "r.new@example.edu",
						fullName: "Приклад Олена Петрівна",
					});
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

					assert.deepStrictEqual(older, { parsed: 0, emptied: [], kept: [] });
					assert.deepStrictEqual(yield* enrollmentsOf("986001"), before);
				}),
		);

		it.effect("fails a change number taken outside the turn", () =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;

				for (const table of ["students", "student_programmes", "enrollments"]) {
					const outside = yield* sql`
						UPDATE ${sql(table)} SET change_no = nextval('change_no_seq') WHERE false
					`.pipe(Effect.flip);

					assert.include(
						Cause.pretty(Cause.fail(outside)),
						"change_no written outside the writers' turn",
					);
				}
			}),
		);
	});
});

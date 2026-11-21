import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Option, Result } from "effect";
import { SqlClient } from "effect/sql";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { TestDatabase, testDatabaseUrl } from "../db/testing.ts";
import { smartRowsOf } from "./catalog.ts";
import { link, smartLists } from "./catalog.fixture.ts";
import { parseSmart } from "./parse.ts";
import { OfferingStore } from "../offerings/OfferingStore.ts";
import { OfferingTeacherStore } from "./OfferingTeacherStore.ts";
import { SmartStore } from "./SmartStore.ts";

const TestLive = Layer.mergeAll(
	SmartStore.layer,
	OfferingStore.layer,
	OfferingTeacherStore.layer,
).pipe(
	Layer.provideMerge(ChangeLog.layer),
	Layer.provideMerge(TestDatabase(testDatabaseUrl)),
);

/** Stores the four lists as one smart.ukma run's snapshots. */
const storeLists = Effect.fnUntraced(function* (
	lists: ReturnType<typeof smartLists>,
) {
	const sql = yield* SqlClient.SqlClient;

	const [run] = yield* sql<{ readonly id: bigint }>`
		INSERT INTO runs (source_part, status, finished_at)
		VALUES ('smart-ukma:2031-09-01', 'succeeded', now())
		RETURNING id
	`;

	for (const [kind, content] of [
		["smart_departments", lists.departments],
		["smart_teachers", lists.teachers],
		["smart_disciplines", lists.disciplines],
		["smart_teacher_disciplines", lists.links],
	] as const) {
		yield* sql`
			INSERT INTO page_snapshots (path, kind, content_hash, content, run_id)
			VALUES (${`/${kind}`}, ${kind}, ${content.length}, ${content}, ${run?.id ?? 0n})
		`;
	}
});

const numbersOf = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;

	return yield* sql<{
		readonly smartId: number;
		readonly changeNo: string;
		readonly removed: boolean;
	}>`
		SELECT smart_id AS "smartId", change_no::text AS "changeNo",
			removed_at IS NOT NULL AS removed
		FROM instructors
		UNION ALL
		SELECT smart_id, change_no::text, removed_at IS NOT NULL FROM smart_disciplines
		ORDER BY 1
	`;
});

const linksOf = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;

	return yield* sql<{
		readonly smartId: number;
		readonly teacher: number;
		readonly role: string;
	}>`
		SELECT d.smart_id AS "smartId", l.instructor_smart_id AS teacher, l.role
		FROM smart_discipline_instructors l
		JOIN smart_disciplines d ON d.id = l.discipline_id
		ORDER BY 1, 2
	`;
});

layer(TestLive, { timeout: 30_000, excludeTestServices: true })(
	"SmartStore",
	(it) => {
		it.effect("does nothing before every list is stored", () =>
			Effect.gen(function* () {
				const store = yield* SmartStore;

				assert.isTrue(Option.isNone(yield* store.latest()));
			}),
		);

		it.effect(
			"numbers new and changed rows only, and removes rows gone from a list",
			() =>
				Effect.gen(function* () {
					yield* storeLists(smartLists());
					yield* parseSmart("reparse");

					const first = yield* numbersOf();

					assert.deepStrictEqual(
						first.map(({ smartId }) => smartId),
						[5001, 5002, 5003, 7001, 7002],
					);
					assert.deepStrictEqual(yield* linksOf(), [
						{ smartId: 5001, teacher: 7001, role: "LECTURER" },
						{ smartId: 5001, teacher: 7002, role: "PRACTICE_TEACHER" },
						{
							smartId: 5002,
							teacher: 7999,
							role: "LECTURER_AND_PRACTICE_TEACHER",
						},
					]);

					yield* parseSmart("reparse");

					assert.deepStrictEqual(yield* numbersOf(), first);

					const lists = smartLists();
					const disciplines = JSON.parse(lists.disciplines);

					disciplines.items = disciplines.items.slice(0, 2);
					disciplines.total = 2;

					yield* storeLists({
						...lists,
						disciplines: JSON.stringify(disciplines),
						links: JSON.stringify({
							items: [link(5002, 7001, "LECTURER")],
							total: 1,
						}),
					});
					yield* parseSmart("reparse");

					const after = yield* numbersOf();

					const changed = (smartId: number) =>
						after.find((row) => row.smartId === smartId)?.changeNo !==
						first.find((row) => row.smartId === smartId)?.changeNo;

					assert.deepStrictEqual([5001, 5002, 5003, 7001, 7002].map(changed), [
						true,
						true,
						true,
						false,
						false,
					]);
					assert.deepStrictEqual(
						after
							.filter(({ removed }) => removed)
							.map(({ smartId }) => smartId),
						[5003],
					);
					assert.deepStrictEqual(yield* linksOf(), [
						{ smartId: 5002, teacher: 7001, role: "LECTURER" },
					]);
				}),
		);

		it.effect("writes nothing from lists older than the newest stored", () =>
			Effect.gen(function* () {
				const store = yield* SmartStore;
				const sql = yield* SqlClient.SqlClient;
				const old = yield* store.latest();

				yield* storeLists(smartLists());

				const rows = Result.getOrThrow(smartRowsOf(smartLists()));

				assert.isTrue(Option.isSome(old));

				if (Option.isSome(old)) {
					const written = yield* store.write(
						rows.instructors,
						rows.disciplines,
						old.value,
						{},
					);

					assert.isTrue(Option.isNone(written));
				}

				yield* parseSmart("reparse");

				const [last] = yield* sql<{ readonly parsed: number | null }>`
					SELECT (report ->> 'parsed')::int AS parsed FROM parses
					WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 1
				`;

				assert.strictEqual(last?.parsed, 4);
			}),
		);

		it.effect(
			"links matched teachers to an offering and renumbers it only on a change",
			() =>
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const changes = yield* ChangeLog;

					yield* changes.withTurn(
						Effect.gen(function* () {
							const [snapshot] = yield* sql<{ readonly id: bigint }>`
								SELECT id FROM page_snapshots LIMIT 1
							`;

							yield* sql`
								INSERT INTO departments (id, name, change_no)
								VALUES ('dep_x', 'Кафедра вигаданих систем', nextval('change_no_seq'))
							`;
							yield* sql`
								INSERT INTO offerings (
									id, saz_code, academic_year, title, department_id, level,
									format, credits, hours, study_year, status, is_practical,
									group_size_min, group_size_max, snapshot_id, change_no
								)
								VALUES (
									'off_x', '990001', 2031, 'Уявні алгоритми', 'dep_x',
									'bachelor', '2015', 4, 120, 1, 'held', false, 10, 20,
									${snapshot?.id ?? 0n}, nextval('change_no_seq')
								)
							`;
						}),
					);

					const offeringNo = () =>
						sql<{ readonly changeNo: string }>`
							SELECT change_no::text AS "changeNo" FROM offerings WHERE id = 'off_x'
						`.pipe(Effect.map(([row]) => row?.changeNo));

					const linked = () =>
						sql<{ readonly smartId: number; readonly role: string }>`
							SELECT i.smart_id AS "smartId", oi.role
							FROM offering_instructors oi
							JOIN instructors i ON i.id = oi.instructor_id
							WHERE oi.offering_id = 'off_x'
							ORDER BY 1
						`;

					yield* storeLists(smartLists());

					const before = yield* offeringNo();

					yield* parseSmart("reparse");

					const after = yield* offeringNo();

					assert.notStrictEqual(after, before);
					assert.deepStrictEqual(yield* linked(), [
						{ smartId: 7001, role: "LECTURER" },
						{ smartId: 7002, role: "PRACTICE_TEACHER" },
					]);

					yield* parseSmart("reparse");

					assert.strictEqual(yield* offeringNo(), after);
				}),
		);

		it.effect("reads a list larger than one query may carry", () =>
			Effect.gen(function* () {
				const store = yield* SmartStore;
				const lists = smartLists();
				const disciplines = JSON.parse(lists.disciplines);

				// 2.5 million two-byte characters: two parts, split mid-text.
				disciplines.items[0].descriptionUa = "ї".repeat(2_500_000);

				const large = JSON.stringify(disciplines);

				yield* storeLists({ ...lists, disciplines: large });

				const stored = yield* store.latest();

				assert.isTrue(Option.isSome(stored));
				assert.strictEqual(
					Option.isSome(stored) ? stored.value.lists.disciplines : "",
					large,
				);
			}),
		);

		it.effect("keeps every row when a list comes back empty", () =>
			Effect.gen(function* () {
				const before = yield* numbersOf();

				yield* storeLists(
					smartLists({ teachers: JSON.stringify({ items: [], total: 0 }) }),
				);
				yield* parseSmart("reparse");

				const after = yield* numbersOf();

				assert.deepStrictEqual(
					after.filter(({ smartId }) => smartId > 7000),
					before.filter(({ smartId }) => smartId > 7000),
				);
				assert.isTrue(Result.isSuccess(smartRowsOf(smartLists())));
			}),
		);
	},
);

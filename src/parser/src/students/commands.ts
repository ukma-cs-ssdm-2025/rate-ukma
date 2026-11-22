import { Clock, Console, Effect, type Layer, Option, Schema } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import type { Audit } from "../audit/Audit.ts";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { ago, DRY_RUN, fail } from "../cli/output.ts";
import { ListReader } from "../lists/ListReader.ts";
import {
	MAX_PAGE,
	REVIEW_CASE_KINDS,
	REVIEW_CASE_STATUSES,
	type ReviewCase as ReviewCaseSchema,
} from "../lists/lists.ts";

type ReviewCase = typeof ReviewCaseSchema.Type;

import {
	type CasePerson,
	closeSamePerson,
	decideSamePerson,
	type ReviewCaseRefused,
	type StudentCase,
	studentCase,
} from "./cases.ts";
import type { StudentCaseStore } from "./StudentCaseStore.ts";

/** `candidates` as each kind stores it: id arrays under named keys, such as
 *  `studentIds` or `offeringIds`, beside plain values. */
const Candidates = Schema.Record(
	Schema.String,
	Schema.Union([Schema.Array(Schema.Unknown), Schema.Unknown]),
);

const isIds = Schema.is(Schema.Array(Schema.Unknown));

/** The ids under a case's `candidate` keys. */
const candidateCount = (candidates: ReviewCase["candidates"]): number =>
	Option.match(Schema.decodeUnknownOption(Candidates)(candidates), {
		onNone: () => 0,
		onSome: (byKey) =>
			Object.values(byKey).reduce<number>(
				(count, ids) => count + (isIds(ids) ? ids.length : 0),
				0,
			),
	});

/** One line of `cases list`. */
export const describeCase = (reviewCase: ReviewCase, now: number): string =>
	[
		reviewCase.id,
		reviewCase.kind,
		reviewCase.status,
		`opened ${ago(reviewCase.openedAt, now)}`,
		`candidates ${candidateCount(reviewCase.candidates)}`,
	].join("\t");

const describePerson = (person: CasePerson) =>
	[
		`student ${person.studentId}`,
		`record ${person.recordId ?? "none"}`,
		`${person.lastName} ${person.firstName}`.trim(),
		person.programme ?? "no programme",
		person.studyYear === null ? "year unknown" : `year ${person.studyYear}`,
		person.status ?? "status unknown",
	].join("\t");

/** `cases show`: the case, the record that opened it and each candidate. */
export const describeStudentCase = (
	found: StudentCase,
	now: number,
): ReadonlyArray<string> => [
	`${found.id}\t${found.kind}\t${found.status}\topened ${ago(found.openedAt, now)} (${found.openedAt.toISOString()})`,
	`record:\t${describePerson(found.record)}`,
	`joined student (safe answer):\t${found.joinedStudentId ?? "none"}`,
	`candidates (${found.candidates.length}):`,
	...found.candidates.map((person) => `\t${describePerson(person)}`),
];

/** One line for each failure `cases show` and `cases decide` act on. */
const caseFailures = (id: string) => ({
	ReviewCaseNotFound: () => fail(`No review case ${id}`),
	ReviewCaseRefused: ({ reason }: ReviewCaseRefused) =>
		fail(
			reason === "not_open"
				? `Refused (not_open): case ${id} is already decided or obsolete`
				: `Refused (not_student_match): case ${id} is not a student_match case; only those can be shown or decided here`,
		),
});

/** The `--kind` and `--status` of `cases list`, when given. */
interface CaseFilters {
	kind?: (typeof REVIEW_CASE_KINDS)[number];
	status?: (typeof REVIEW_CASE_STATUSES)[number];
}

const caseId = Argument.String("id").pipe(
	Argument.withDescription("The review case id, from `cases list`"),
);

const listCases = Command.make(
	"list",
	{
		kind: Flag.Literals("kind", REVIEW_CASE_KINDS).pipe(
			Flag.withDescription("Only cases of this kind"),
			Flag.optional,
		),
		status: Flag.Literals("status", REVIEW_CASE_STATUSES).pipe(
			Flag.withDescription("Only cases with this status"),
			Flag.optional,
		),
	},
	({ kind, status }) =>
		Effect.gen(function* () {
			const lists = yield* ListReader;
			const now = yield* Clock.currentTimeMillis;

			const filters: CaseFilters = {};

			if (Option.isSome(kind)) filters.kind = kind.value;

			if (Option.isSome(status)) filters.status = status.value;

			let after = 0;
			let more = true;
			let total = 0;

			while (more) {
				const page = yield* lists.reviewCases({
					...filters,
					after,
					limit: MAX_PAGE,
				});

				for (const reviewCase of page.items) {
					yield* Console.log(describeCase(reviewCase, now));
				}

				total += page.items.length;
				after = page.cursor;
				more = page.hasMore;
			}

			yield* Console.log(`${total} case${total === 1 ? "" : "s"}`);
		}).pipe(Effect.withSpan("Cases.list")),
).pipe(
	Command.withDescription(
		"List review cases: id, kind, status, age and candidate count",
	),
);

const showCase = Command.make("show", { id: caseId }, ({ id }) =>
	Effect.gen(function* () {
		const found = yield* studentCase(id);
		const now = yield* Clock.currentTimeMillis;

		for (const line of describeStudentCase(found, now)) {
			yield* Console.log(line);
		}
	}).pipe(Effect.catchTags(caseFailures(id)), Effect.withSpan("Cases.show")),
).pipe(Command.withDescription("Show a student_match case and its candidates"));

const decideCase = Command.make(
	"decide",
	{
		id: caseId,
		decision: Argument.Literals("decision", ["same_person"]).pipe(
			Argument.withDescription(
				"same_person: the record is the student it joined",
			),
		),
		yes: Flag.Boolean("yes").pipe(
			Flag.withDescription("Write the decision; without it, a dry run"),
			Flag.withDefault(false),
		),
	},
	({ id, yes }) =>
		Effect.gen(function* () {
			const found = yield* studentCase(id);
			const now = yield* Clock.currentTimeMillis;

			for (const line of describeStudentCase(found, now)) {
				yield* Console.log(line);
			}

			const effect = [
				`case ${id}: status ${found.status} -> decided`,
				`record ${found.record.recordId ?? "none"}: stays with student ${found.joinedStudentId ?? "none"}; no student or record changes`,
				"audit: student_case_decided, recorded with no key, as the command line",
			];

			if (yes) {
				yield* decideSamePerson(null, id);
				yield* Console.log("Wrote:");

				for (const line of effect) yield* Console.log(`\t${line}`);

				return;
			}

			const changes = yield* ChangeLog;
			const { written } = yield* changes.rehearse(closeSamePerson(null, id));

			yield* Console.log("Would change:");

			for (const line of effect) yield* Console.log(`\t${line}`);
			yield* Console.log("Rows written:");

			for (const { table, action, rows } of written) {
				yield* Console.log(`\t${table}: ${rows} ${action}`);
			}

			yield* Console.log(DRY_RUN);
		}).pipe(
			Effect.catchTags(caseFailures(id)),
			Effect.withSpan("Cases.decide"),
		),
).pipe(
	Command.withDescription(
		"Decide a student_match case; a dry run unless --yes",
	),
);

/** `cases list|show|decide` with their services from `services`. */
export const caseCommands = <E, R>(
	services: Layer.Layer<
		ListReader | StudentCaseStore | ChangeLog | Audit,
		E,
		R
	>,
) =>
	Command.make("cases").pipe(
		Command.withDescription("Review cases"),
		Command.withSubcommands([listCases, showCase, decideCase]),
		Command.provide(services),
	);

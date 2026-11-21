import { Effect, Option, Result, Schema } from "effect";
import { Audit } from "../audit/Audit.ts";
import { ChangeLog } from "../changes/ChangeLog.ts";
import { parseStudentsPage } from "../saz/studentsPage.ts";
import { type PersonRow, StudentCaseStore } from "./StudentCaseStore.ts";

export class ReviewCaseNotFound extends Schema.TaggedError<ReviewCaseNotFound>()(
	"ReviewCaseNotFound",
	{ caseId: Schema.String },
	{ httpApiStatus: 404 },
) {}

export class ReviewCaseRefused extends Schema.TaggedError<ReviewCaseRefused>()(
	"ReviewCaseRefused",
	{ reason: Schema.Literals(["not_student_match", "not_open"]) },
	{ httpApiStatus: 409 },
) {}

export const CasePerson = Schema.Struct({
	studentId: Schema.String,
	recordId: Schema.NullOr(Schema.String).annotate({
		description: "The programme record the details come from",
	}),
	firstName: Schema.String,
	lastName: Schema.String,
	programme: Schema.NullOr(Schema.String),
	studyYear: Schema.NullOr(Schema.Int),
	status: Schema.NullOr(Schema.Literals(["active", "inactive"])),
}).annotate({ identifier: "CasePerson" });

export type CasePerson = typeof CasePerson.Type;

export const StudentCase = Schema.Struct({
	id: Schema.String,
	kind: Schema.Literal("student_match"),
	status: Schema.Literals(["open", "decided", "obsolete"]),
	openedAt: Schema.Date,
	record: CasePerson.annotate({
		description:
			"The programme record that opened the case, as САЗ last listed it",
	}),
	joinedStudentId: Schema.NullOr(Schema.String).annotate({
		description: "The student the record joined: the safe answer",
	}),
	candidates: Schema.Array(CasePerson).annotate({
		description:
			"Each matching student, from their newest other programme record",
	}),
}).annotate({ identifier: "StudentCase" });

export type StudentCase = typeof StudentCase.Type;

/** `Прізвище Ім'я По батькові`: the surname comes first (ADR-0013). */
const namesOf = (fullName: string) => {
	const [lastName = "", ...rest] = fullName.split(" ");

	return { lastName, firstName: rest.slice(0, 1).join(" ") };
};

/** A person as their record's students page shows them; the student's stored
 *  name when the page no longer parses or lists the record. */
const personOf = (row: PersonRow): CasePerson => {
	const entry =
		row.content === null || row.cdoc === null
			? undefined
			: Result.getOrUndefined(parseStudentsPage(row.content))?.find(
					({ cdoc }) => cdoc === row.cdoc,
				);

	return {
		studentId: row.studentId,
		recordId: row.recordId,
		...namesOf(entry?.fullName ?? row.fullName),
		programme: row.programme,
		studyYear: entry?.grade ?? null,
		status:
			entry === undefined
				? null
				: entry.isStudentActive
					? "active"
					: "inactive",
	};
};

// oxlint-disable-next-line anti-slop-effect/require-named-effect-fn -- the StudentCaseStore spans cover the lookup.
const studentMatch = Effect.fnUntraced(function* (id: string) {
	const store = yield* StudentCaseStore;
	const found = yield* store.find(id);

	if (Option.isNone(found))
		return yield* new ReviewCaseNotFound({ caseId: id });

	if (found.value.kind !== "student_match") {
		return yield* new ReviewCaseRefused({ reason: "not_student_match" });
	}

	return found.value;
});

/** A `student_match` case with the names, programmes, study years and
 *  statuses staff need to tell whether two records are one person. */
export const studentCase = Effect.fn("Students.studentCase")(function* (
	id: string,
) {
	const store = yield* StudentCaseStore;
	const found = yield* studentMatch(id);
	const record = yield* store.record(found.recordId);

	const candidates = yield* store.candidates(
		found.candidateIds,
		found.recordId,
	);

	if (Option.isNone(record))
		return yield* new ReviewCaseNotFound({ caseId: id });

	return {
		id: found.id,
		kind: "student_match" as const,
		status: found.status,
		openedAt: found.openedAt,
		record: personOf(record.value),
		joinedStudentId: found.studentId,
		candidates: candidates.map(personOf),
	};
});

/** Staff confirm the safe answer: the record is the student it joined. The
 *  case closes; the record stays where it is. */
export const decideSamePerson = Effect.fn("Students.decideSamePerson")(
	function* (keyId: string, id: string) {
		const store = yield* StudentCaseStore;
		const changes = yield* ChangeLog;
		const audit = yield* Audit;

		return yield* changes.withTurn(
			Effect.gen(function* () {
				const found = yield* studentMatch(id);

				if (!(yield* store.close(id))) {
					return yield* new ReviewCaseRefused({ reason: "not_open" });
				}

				yield* audit.record({
					action: "student_case_decided",
					keyId,
					targetId: id,
					relatedId: found.studentId ?? undefined,
				});
			}),
		);
	},
);

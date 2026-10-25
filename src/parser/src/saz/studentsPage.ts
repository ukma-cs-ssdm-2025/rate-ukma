import {
	DateTime,
	Predicate,
	Result,
	Schema,
	SchemaIssue,
	SchemaTransformation,
} from "effect";

/** Seconds since the epoch, as an ISO instant; САЗ sends 0 when it does not
 *  know (D10). Bounded so a wild value fails its page, not the batch. */
const Timestamp = Schema.Int.check(
	Schema.isBetween({ minimum: 0, maximum: 4_102_444_800 }),
).pipe(
	Schema.decodeTo(
		Schema.NullOr(Schema.String),
		SchemaTransformation.transform({
			decode: (seconds) =>
				seconds === 0
					? null
					: DateTime.formatIso(DateTime.makeUnsafe(seconds * 1000)),
			encode: (instant) =>
				instant === null
					? 0
					: DateTime.toEpochMillis(DateTime.makeUnsafe(instant)) / 1000,
		}),
	),
);

const Text = Schema.String.check(Schema.isPattern(/\S/u));

/** The kind of the course for this student's programme (D11). */
const Kind = Schema.Literals(["mandat", "option", "zfree"]).transform([
	"compulsory",
	"prof_oriented",
	"elective",
]);

const Status = Schema.Literals([10, -10]).transform(["enrolled", "unenrolled"]);

/** One entry of a students page, all 17 keys. The labels and the
 *  `isEnrolled`/`isUnenrolled` flags follow from `status`, `isStudentActive`
 *  and `isForced`, so they are checked but not kept. */
const Entry = Schema.Struct({
	cdoc: Schema.Int.check(Schema.isGreaterThan(0)),
	name: Text,
	email: Schema.String,
	specName: Text,
	type: Kind,
	typeLabel: Schema.String,
	status: Status,
	statusLabel: Schema.String,
	statusDescription: Schema.String,
	isStudentActive: Schema.Boolean,
	isForced: Schema.Boolean,
	isEnrolled: Schema.Boolean,
	isUnenrolled: Schema.Boolean,
	group: Schema.NullOr(
		Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 999 })),
	),
	grade: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 9 })),
	createdAt: Timestamp,
	updatedAt: Timestamp,
});

/** A student on one offering's list, with the person fields normalised. */
export interface StudentEntry {
	readonly cdoc: string;
	/** Lower-case (D5); null when САЗ sends none (D3). */
	readonly email: string | null;
	/** Whitespace collapsed (D6). */
	readonly fullName: string;
	readonly specName: string;
	readonly kind: typeof Kind.Type;
	readonly status: typeof Status.Type;
	readonly isStudentActive: boolean;
	readonly isForced: boolean;
	readonly groupNo: number | null;
	readonly grade: number;
	readonly sazCreatedAt: string | null;
	readonly sazUpdatedAt: string | null;
}

/** Why a students page did not parse. `reason` names a key at most, never a
 *  value, since the page holds names and emails and the reason is logged. */
export class StudentsPageError extends Schema.TaggedError<StudentsPageError>()(
	"StudentsPageError",
	{ reason: Schema.String },
) {}

const decodePage = Schema.decodeUnknownResult(
	Schema.fromJsonString(Schema.Array(Entry)),
	{ onExcessProperty: "error" },
);

const formatIssue = SchemaIssue.makeFormatterStandardSchemaV1();

/** The entry key the first decoding issue points at. */
const keyOf = (issue: SchemaIssue.Issue): string => {
	const key = (formatIssue(issue).issues[0]?.path ?? [])
		.map((segment) => (Predicate.isObject(segment) ? segment.key : segment))
		.filter(Predicate.isString)
		.at(-1);

	return key ?? "page";
};

const collapse = (text: string) => text.replace(/\s+/gu, " ").trim();

/** Parses the stored page of `/course/<code>/students`. `[]` is a valid,
 *  empty list. */
export const parseStudentsPage = (
	content: string,
): Result.Result<ReadonlyArray<StudentEntry>, StudentsPageError> =>
	Result.gen(function* () {
		const entries = yield* decodePage(content).pipe(
			Result.mapError(
				(error) =>
					new StudentsPageError({ reason: `invalid ${keyOf(error.issue)}` }),
			),
		);

		if (new Set(entries.map(({ cdoc }) => cdoc)).size < entries.length) {
			return yield* Result.fail(
				new StudentsPageError({ reason: "repeated cdoc" }),
			);
		}

		return entries.map((entry) => ({
			cdoc: String(entry.cdoc),
			email:
				entry.email.trim() === "" ? null : entry.email.trim().toLowerCase(),
			fullName: collapse(entry.name),
			specName: collapse(entry.specName),
			kind: entry.type,
			status: entry.status,
			isStudentActive: entry.isStudentActive,
			isForced: entry.isForced,
			groupNo: entry.group,
			grade: entry.grade,
			sazCreatedAt: entry.createdAt,
			sazUpdatedAt: entry.updatedAt,
		}));
	});

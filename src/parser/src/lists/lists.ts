import { Effect, Schema, type SchemaAST, SchemaTransformation } from "effect";

export const MAX_PAGE = 1000;

/** A query integer; OpenAPI shows only the string a query carries, so the
 *  description names the range and the default. */
const queryInt = (
	range: SchemaAST.Filter<number>,
	fallback: number,
	description: string,
) =>
	Schema.String.check(Schema.isPattern(/^\d+$/))
		.annotate({ description: `${description}, default ${fallback}` })
		.pipe(
			Schema.decodeTo(
				Schema.Int.check(range),
				SchemaTransformation.numberFromString,
			),
			Schema.withDecodingDefaultKey(Effect.succeed(String(fallback))),
		);

/** `?after=<change number>&limit=<rows>`: rows numbered above `after`. */
export const PageQuery = {
	after: queryInt(
		Schema.isGreaterThanOrEqualTo(0),
		0,
		"The change number saved after the last sync; 0 for all rows",
	),
	limit: queryInt(
		Schema.isBetween({ minimum: 1, maximum: MAX_PAGE }),
		500,
		`Rows per page, 1 to ${MAX_PAGE}`,
	),
};

export interface PageRequest {
	readonly after: number;
	readonly limit: number;
}

/** `PageQuery` plus `?year=<first calendar year>`: one academic year's rows. */
export const YearPageQuery = {
	...PageQuery,
	year: queryInt(
		Schema.isGreaterThanOrEqualTo(0),
		0,
		"The academic year's first calendar year, as 2031 for 2031-32; 0 for every year",
	),
};

export interface YearPageRequest extends PageRequest {
	readonly year: number;
}

/** One page of a list in change-number order. A reader stores every page,
 *  then saves `cursor` once `hasMore` is false (spec rule 5). */
export const Page = <S extends Schema.Top>(item: S, identifier: string) =>
	Schema.Struct({
		items: Schema.Array(item),
		cursor: Schema.Int.annotate({
			description:
				"The last item's change number, or `after` when the page is empty",
		}),
		hasMore: Schema.Boolean,
		dataUpdatedAt: Schema.NullOr(Schema.Date).annotate({
			description: "When САЗ was last read: the latest successful run finished",
		}),
	}).annotate({ identifier });

export interface PageOf<A> {
	readonly items: ReadonlyArray<A>;
	readonly cursor: number;
	readonly hasMore: boolean;
	readonly dataUpdatedAt: Date | null;
}

/** `rows` is the query's `limit + 1` rows: the extra one only tells that
 *  more follow. */
export const toPage = <A extends { readonly changeNo: number }>(
	rows: ReadonlyArray<A>,
	request: PageRequest,
	dataUpdatedAt: Date | null,
): PageOf<A> => {
	const items = rows.slice(0, request.limit);

	return {
		items,
		cursor: items.at(-1)?.changeNo ?? request.after,
		hasMore: rows.length > request.limit,
		dataUpdatedAt,
	};
};

const changeNo = Schema.Int;

const removedAt = Schema.NullOr(Schema.Date).annotate({
	description: "Set when the row left its source; readers hide such rows",
});

const Level = Schema.Literals(["bachelor", "master"]);

export const Term = Schema.Struct({
	id: Schema.String,
	code: Schema.String,
	academicYear: Schema.Int,
	season: Schema.Literals(["FALL", "SPRING", "SUMMER"]),
	changeNo,
}).annotate({ identifier: "Term" });

export const Faculty = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	sazFilterId: Schema.NullOr(Schema.String),
	changeNo,
	removedAt,
}).annotate({ identifier: "Faculty" });

export const Department = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	sazFilterId: Schema.NullOr(Schema.String),
	facultyId: Schema.NullOr(Schema.String),
	changeNo,
	removedAt,
}).annotate({ identifier: "Department" });

export const Programme = Schema.Struct({
	id: Schema.String,
	name: Schema.String,
	level: Schema.NullOr(Level),
	sazFilterId: Schema.NullOr(Schema.String),
	changeNo,
	removedAt,
}).annotate({ identifier: "Programme" });

const OfferingTerm = Schema.Struct({
	termId: Schema.String,
	semesters: Schema.Array(Schema.Int),
	credits: Schema.Number,
	hoursPerWeek: Schema.NullOr(Schema.Int),
	lectureHours: Schema.NullOr(Schema.Int),
	seminarHours: Schema.NullOr(Schema.Int),
	practiceHours: Schema.NullOr(Schema.Int),
	control: Schema.NullOr(
		Schema.Literals(["pass_fail", "exam", "thesis", "none", "thesis_defence"]),
	),
}).annotate({ identifier: "OfferingTerm" });

const OfferingProgramme = Schema.Struct({
	programmeId: Schema.String,
	kind: Schema.Literals(["compulsory", "prof_oriented", "elective"]),
}).annotate({ identifier: "OfferingProgramme" });

/** A smart.ukma teacher the matching rule linked to an offering. */
const OfferingInstructor = Schema.Struct({
	id: Schema.String,
	lastName: Schema.String,
	firstName: Schema.String,
	middleName: Schema.NullOr(Schema.String),
	email: Schema.NullOr(Schema.String),
	role: Schema.Literals([
		"lecturer",
		"practice_teacher",
		"lecturer_and_practice_teacher",
	]),
}).annotate({ identifier: "OfferingInstructor" });

/** One САЗ card. The card's teacher cell is left out; the smart.ukma
 *  teachers linked to it are `OfferingTeachers`. */
export const Offering = Schema.Struct({
	id: Schema.String,
	sazCode: Schema.String,
	academicYear: Schema.Int,
	title: Schema.String,
	facultyId: Schema.NullOr(Schema.String),
	departmentId: Schema.NullOr(Schema.String),
	level: Level,
	format: Schema.String,
	credits: Schema.Number,
	hours: Schema.Int,
	studyYear: Schema.Int,
	status: Schema.Literals(["held", "not_held", "may_hold", "unknown"]),
	isPractical: Schema.Boolean,
	annotation: Schema.NullOr(Schema.String),
	maxStudents: Schema.NullOr(Schema.Int),
	maxGroups: Schema.NullOr(Schema.Int),
	computedMaxStudents: Schema.NullOr(Schema.Int),
	groupSizeMin: Schema.Int,
	groupSizeMax: Schema.Int,
	enrolledActive: Schema.NullOr(Schema.Int),
	courseId: Schema.NullOr(Schema.String).annotate({
		description: "The course grouping this offering across years",
	}),
	terms: Schema.Array(OfferingTerm),
	programmes: Schema.Array(OfferingProgramme),
	changeNo,
	removedAt,
}).annotate({ identifier: "Offering" });

/** An offering's smart.ukma teachers, linked by the matching rule. It takes
 *  the offering's change number, which moves when its teachers change. */
export const OfferingTeachers = Schema.Struct({
	id: Schema.String,
	sazCode: Schema.String,
	academicYear: Schema.Int,
	instructors: Schema.Array(OfferingInstructor),
	changeNo,
	removedAt,
}).annotate({ identifier: "OfferingTeachers" });

/** Offerings of one subject across years. */
export const Course = Schema.Struct({
	id: Schema.String,
	title: Schema.String.annotate({
		description: "The title its offerings share",
	}),
	departmentId: Schema.NullOr(Schema.String),
	level: Level,
	mergedInto: Schema.NullOr(Schema.String).annotate({
		description:
			"The course that now holds its offerings; a reader moves its own data there",
	}),
	mergeSource: Schema.NullOr(Schema.Literals(["rule", "decision"])).annotate({
		description:
			"Who merged it: `rule` for a department handoff, which a later parse undoes when the handoff stops holding, or `decision` for staff",
	}),
	changeNo,
	removedAt,
}).annotate({ identifier: "Course" });

const ReviewCaseKind = Schema.Literals([
	"course_match",
	"instructor_match",
	"student_match",
	"removals_held",
]);

const ReviewCaseStatus = Schema.Literals(["open", "decided", "obsolete"]);

/** `PageQuery` plus optional `?status=` and `?kind=`: only matching cases. */
export const ReviewCaseQuery = {
	...PageQuery,
	status: Schema.optionalKey(
		ReviewCaseStatus.annotate({ description: "Only cases with this status" }),
	),
	kind: Schema.optionalKey(
		ReviewCaseKind.annotate({ description: "Only cases of this kind" }),
	),
};

export interface ReviewCaseRequest extends PageRequest {
	readonly status?: typeof ReviewCaseStatus.Type;
	readonly kind?: typeof ReviewCaseKind.Type;
}

export const ReviewCase = Schema.Struct({
	id: Schema.String,
	kind: ReviewCaseKind,
	subjectId: Schema.String,
	candidates: Schema.Json.annotate({ description: "Ids only" }),
	safeAnswer: Schema.Json.annotate({ description: "What was published" }),
	status: ReviewCaseStatus,
	runId: Schema.NullOr(Schema.String),
	decisionId: Schema.NullOr(Schema.String),
	openedAt: Schema.Date,
	changeNo,
}).annotate({ identifier: "ReviewCase" });

/** A review-case page with the number of cases that match its filters. */
export const ReviewCasePage = Schema.Struct({
	...Page(ReviewCase, "ReviewCasePage").fields,
	total: Schema.Int.annotate({
		description:
			"Cases numbered above `after` that match the filters, across every page",
	}),
}).annotate({ identifier: "ReviewCasePage" });

export interface ReviewCasePageOf extends PageOf<typeof ReviewCase.Type> {
	readonly total: number;
}

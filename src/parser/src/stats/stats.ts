import { Schema } from "effect";

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

export const YearStats = Schema.Struct({
	academicYear: Schema.Int.annotate({
		description: "`2025` is the academic year 2025-26",
	}),
	offerings: Count.annotate({ description: "Offerings not removed" }),
	courses: Count.annotate({
		description: "Courses with an offering this year, not merged or removed",
	}),
	students: Count.annotate({
		description: "Students enrolled in an offering this year",
	}),
	enrollments: Count.annotate({
		description: "Enrollments in this year's offerings, not removed",
	}),
	teacherShare: Schema.Number.annotate({
		description:
			"The share of offerings whose САЗ page names a teacher, 0 to 1",
	}),
}).annotate({ identifier: "YearStats" });

const ReviewCaseCounts = Schema.Struct({
	courseMatch: Count,
	instructorMatch: Count,
	studentMatch: Count,
	removalsHeld: Count,
}).annotate({ identifier: "ReviewCaseCounts" });

export const Stats = Schema.Struct({
	years: Schema.Array(YearStats).annotate({
		description: "Every academic year with offerings, latest first",
	}),
	mergedCourses: Schema.Struct({
		rule: Count.annotate({ description: "Merged by a department handoff" }),
		decision: Count.annotate({ description: "Merged by staff" }),
	}),
	openReviewCases: ReviewCaseCounts,
	lastCrawl: Schema.NullOr(
		Schema.Struct({
			finishedAt: Schema.Date,
			status: Schema.Literals(["succeeded", "failed"]),
		}),
	).annotate({
		description: "The САЗ run that finished last, or null before the first",
	}),
	nextCrawlAt: Schema.Date.annotate({
		description:
			"When the worker should start the next САЗ crawl, from the last run and `CRAWL_INTERVAL`; now when one is due or running",
	}),
}).annotate({ identifier: "Stats" });

export type Stats = typeof Stats.Type;

import { z } from "zod";

// Shapes of the Rate UKMA backend's /api/v1/data/ proxy. It holds the UKMA Data
// key and expands the ids in a review case's `candidates` into evidence rows.

export const caseKinds = [
	"course_match",
	"instructor_match",
	"removals_held",
] as const;
export const caseStatuses = ["open", "decided", "obsolete"] as const;
export const decisionKinds = [
	"merge",
	"keep_apart",
	"split",
	"link_instructor",
	"keep_unlinked",
	"apply_removals",
	"drop_removals",
] as const;

export type CaseKind = (typeof caseKinds)[number];
export type CaseStatus = (typeof caseStatuses)[number];
export type DecisionKind = (typeof decisionKinds)[number];

const offeringEvidence = z.object({
	id: z.string(),
	sazCode: z.string(),
	academicYear: z.number().int(),
	title: z.string(),
	department: z.string(),
	credits: z.number(),
	courseId: z.string(),
});
export type OfferingEvidence = z.infer<typeof offeringEvidence>;

const instructorCandidate = z.object({
	id: z.string(),
	fullName: z.string(),
	department: z.string(),
	teaches: z.array(z.string()),
});
export type InstructorCandidate = z.infer<typeof instructorCandidate>;

const caseBase = {
	id: z.string(),
	status: z.enum(caseStatuses),
	openedAt: z.string(),
	runId: z.number().int(),
	decisionId: z.string().nullable(),
};

export const reviewCase = z.discriminatedUnion("kind", [
	z.object({
		...caseBase,
		kind: z.literal("course_match"),
		subject: offeringEvidence,
		candidate: offeringEvidence,
	}),
	z.object({
		...caseBase,
		kind: z.literal("instructor_match"),
		subject: offeringEvidence,
		sazTeacherLine: z.string(),
		candidates: z.array(instructorCandidate),
	}),
	z.object({
		...caseBase,
		kind: z.literal("removals_held"),
		academicYear: z.number().int(),
		liveOfferings: z.number().int(),
		threshold: z.number(),
		offerings: z.array(offeringEvidence),
	}),
]);
export type ReviewCase = z.infer<typeof reviewCase>;

export const decision = z.object({
	id: z.string(),
	kind: z.enum(decisionKinds),
	reviewCaseId: z.string().nullable(),
	reversesId: z.string().nullable(),
	madeAt: z.string(),
	keyName: z.string(),
	staffUser: z.object({ id: z.number().int(), name: z.string() }).nullable(),
	changeNo: z.number().int(),
	rows: z.array(
		z.object({
			list: z.enum(["courses", "offerings", "instructor_links"]),
			id: z.string(),
			change: z.string(),
		}),
	),
});
export type Decision = z.infer<typeof decision>;

export const overview = z.object({
	lastSync: z.object({
		finishedAt: z.string(),
		cursor: z.number().int(),
		ok: z.boolean(),
	}),
	dataUpdatedAt: z.string(),
	lists: z.array(z.object({ name: z.string(), rows: z.number().int() })),
	// The proxy may leave out a kind with no open cases.
	openCases: z
		.partialRecord(z.enum(caseKinds), z.number().int())
		.transform(
			(counts) =>
				Object.fromEntries(
					caseKinds.map((kind) => [kind, counts[kind] ?? 0]),
				) as Record<CaseKind, number>,
		),
	oldestOpenAt: z.string().nullable(),
});
export type Overview = z.infer<typeof overview>;

export type DecisionInput =
	| {
			readonly kind: "link_instructor";
			readonly reviewCaseId: string;
			readonly instructorId: string;
	  }
	| {
			readonly kind: "split";
			readonly reviewCaseId: string;
			readonly reversesId: string;
	  }
	| {
			readonly kind: Exclude<DecisionKind, "link_instructor" | "split">;
			readonly reviewCaseId: string;
	  };

export interface CaseFilter {
	readonly kind?: CaseKind;
	readonly status?: CaseStatus;
}

export const pageOf = <T extends z.ZodType>(item: T) =>
	z.object({ items: z.array(item) });

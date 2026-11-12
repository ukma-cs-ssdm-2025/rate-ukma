import { getLatestOffering } from "@/features/course-offerings/components/CourseCazRecords";
import type {
	CourseOffering,
	CourseOfferingSpeciality,
	CourseOfferingSpecialityInline,
} from "@/lib/api/generated";
import type { PlanCourseKind, PlanTerm } from "./planTypes";

export interface CourseLoad {
	credits: number | null;
	weeklyHours: number | null;
}

const UNKNOWN_LOAD: CourseLoad = { credits: null, weeklyHours: null };

function parseCredits(value: string | undefined): number | null {
	const parsed = Number.parseFloat(value ?? "");
	return Number.isFinite(parsed) ? parsed : null;
}

/** Credits and hours for one semester of an offering. */
export function offeringLoad(
	offering: CourseOffering | undefined,
	term: PlanTerm,
): CourseLoad {
	const terms = offering?.terms ?? [];
	const match =
		terms.find((item) => item.semester_term?.toUpperCase() === term) ??
		terms[0];
	if (!match) return UNKNOWN_LOAD;
	return {
		credits: parseCredits(match.credits),
		weeklyHours: match.weekly_hours ?? null,
	};
}

/** The newest offering that runs in the given term, else the newest one. */
export function offeringForTerm(
	offerings: readonly CourseOffering[],
	term: PlanTerm,
): CourseOffering | undefined {
	const inTerm = offerings.filter((offering) =>
		[
			offering.semester_term,
			...(offering.terms ?? []).map((t) => t.semester_term),
		]
			.map((value) => value?.toUpperCase())
			.includes(term),
	);
	return getLatestOffering(inTerm) ?? getLatestOffering(offerings);
}

/**
 * How the course counts for the student's own speciality. A course their
 * speciality does not list is one they took from elsewhere: free choice.
 */
export function courseKindFor(
	specialities:
		| readonly (CourseOfferingSpeciality | CourseOfferingSpecialityInline)[]
		| undefined,
	specialityId: string | null | undefined,
): PlanCourseKind {
	const own = specialities?.find(
		(speciality) => speciality.speciality_id === specialityId,
	);
	return own?.type_kind ?? "ELECTIVE";
}

import { getLatestOffering } from "@/features/course-offerings/components/CourseCazRecords";
import type {
	CourseOffering,
	CourseOfferingSpeciality,
	CourseOfferingSpecialityInline,
	SemesterTermEnum,
	CourseTypeKindEnum,
} from "@/lib/api/generated";

export interface CourseLoad {
	credits: number | null;
	weeklyHours: number | null;
}

const UNKNOWN_LOAD: CourseLoad = { credits: null, weeklyHours: null };

export function parseCredits(value: string | undefined): number | null {
	const parsed = Number.parseFloat(value ?? "");
	return Number.isFinite(parsed) ? parsed : null;
}

export function offeringLoad(
	offering: CourseOffering | undefined,
	term: SemesterTermEnum,
): CourseLoad {
	const terms = offering?.terms ?? [];
	const match =
		terms.find((item) => item.semester_term?.toUpperCase() === term) ??
		terms[0];
	if (!match) {
		return UNKNOWN_LOAD;
	}
	return {
		credits: parseCredits(match.credits),
		weeklyHours: match.weekly_hours ?? null,
	};
}

export function offeringForTerm(
	offerings: readonly CourseOffering[],
	term: SemesterTermEnum,
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

export function courseKindFor(
	specialities:
		| readonly (CourseOfferingSpeciality | CourseOfferingSpecialityInline)[]
		| undefined,
	specialityId: string | null | undefined,
): CourseTypeKindEnum {
	const own = specialities?.find(
		(speciality) => speciality.speciality_id === specialityId,
	);
	return own?.type_kind ?? "ELECTIVE";
}

import { keepPreviousData } from "@tanstack/react-query";

import type { CoursesListParams } from "@/lib/api/generated";
import { useCoursesList } from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { CREDITS_FILTER_RANGE } from "../planRules";
import type { ChoiceKind, PlanTerm } from "../planTypes";

export const CATALOG_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

export interface CatalogFilters {
	term: PlanTerm;
	kind: ChoiceKind | "all";
	credits: [number, number];
	query: string;
}

export function defaultCatalogFilters(term: PlanTerm): CatalogFilters {
	return {
		term,
		kind: "PROF_ORIENTED",
		credits: CREDITS_FILTER_RANGE,
		query: "",
	};
}

function toParams(
	filters: CatalogFilters,
	academicYearStart: number,
	specialityId: string | undefined,
	pageSize: number,
): CoursesListParams {
	const [minCredits, maxCredits] = filters.credits;
	const creditsNarrowed =
		minCredits > CREDITS_FILTER_RANGE[0] ||
		maxCredits < CREDITS_FILTER_RANGE[1];
	return {
		page_size: pageSize,
		name: filters.query.trim() || undefined,
		semester_terms: [filters.term],
		// The backend reads credits off one academic year's offerings.
		semester_year: `${academicYearStart}–${academicYearStart + 1}`,
		...(creditsNarrowed && {
			credits_min: minCredits,
			credits_max: maxCredits,
		}),
		// A kind only means something for a speciality: the backend rejects
		// type_kind without one, and reads ELECTIVE as "neither compulsory nor
		// profession-oriented for it". Without a speciality, list every kind.
		...(filters.kind !== "all" &&
			specialityId && { type_kind: filters.kind, speciality: specialityId }),
	};
}

/** Courses offered in the current catalog, for picking into a planned semester. */
export function useCatalogCourses(
	filters: CatalogFilters,
	academicYearStart: number,
	pageSize: number,
) {
	const { speciality } = useAuth();
	const query = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
	const params = toParams(
		{ ...filters, query },
		academicYearStart,
		speciality?.id,
		pageSize,
	);
	return useCoursesList(params, {
		query: { placeholderData: keepPreviousData },
	});
}

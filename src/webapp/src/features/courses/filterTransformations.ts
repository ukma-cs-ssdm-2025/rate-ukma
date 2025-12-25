import type { CoursesListParams } from "@/lib/api/generated";
import type { CourseFiltersParamsState } from "./courseFiltersParams";
import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "./courseFormatting";

export function transformFiltersToApiParams(
	filters: CourseFiltersParamsState,
): Partial<CoursesListParams> {
	const params: Partial<CoursesListParams> = {};

	if (filters.q) params.name = filters.q;
	if (filters.faculty) params.faculty = filters.faculty;
	if (filters.dept) params.department = filters.dept;
	if (filters.instructor) params.instructor = filters.instructor;
	if (filters.term) params.semester_term = filters.term;
	if (filters.year) params.semester_year = filters.year;
	if (filters.type) params.type_kind = filters.type;
	if (filters.spec) params.speciality = filters.spec;

	if (
		filters.diff[0] !== DIFFICULTY_RANGE[0] ||
		filters.diff[1] !== DIFFICULTY_RANGE[1]
	) {
		params.avg_difficulty_min = filters.diff[0];
		params.avg_difficulty_max = filters.diff[1];
	}

	if (
		filters.use[0] !== USEFULNESS_RANGE[0] ||
		filters.use[1] !== USEFULNESS_RANGE[1]
	) {
		params.avg_usefulness_min = filters.use[0];
		params.avg_usefulness_max = filters.use[1];
	}

	return params;
}

export function transformSortingToApiParams(
	sortingId: string,
	isDescending: boolean,
): Record<string, "asc" | "desc"> {
	if (sortingId === "avg_difficulty") {
		return {
			avg_difficulty_order: isDescending ? "desc" : "asc",
		};
	}

	if (sortingId === "avg_usefulness") {
		return {
			avg_usefulness_order: isDescending ? "desc" : "asc",
		};
	}

	return {};
}

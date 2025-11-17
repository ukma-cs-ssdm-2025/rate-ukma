import type { FilterState } from "./filterSchema";
import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "./courseFormatting";

/**
 * API query parameters for course list
 */
export type CourseApiFilters = {
	name?: string;
	faculty?: string;
	department?: string;
	instructor?: string;
	typeKind?: string;
	speciality?: string;
	semesterTerm?: string;
	semesterYear?: number;
	avg_difficulty_min?: number;
	avg_difficulty_max?: number;
	avg_usefulness_min?: number;
	avg_usefulness_max?: number;
};

/**
 * Transform filter form state to API query parameters
 * Excludes default/empty values to keep API calls clean
 */
export function transformFiltersToApiParams(
	filters: FilterState,
): CourseApiFilters {
	const isDifficultyModified =
		filters.difficultyRange[0] !== DIFFICULTY_RANGE[0] ||
		filters.difficultyRange[1] !== DIFFICULTY_RANGE[1];

	const isUsefulnessModified =
		filters.usefulnessRange[0] !== USEFULNESS_RANGE[0] ||
		filters.usefulnessRange[1] !== USEFULNESS_RANGE[1];

	const params: Record<string, string | number | undefined> = {
		name: filters.searchQuery,
		faculty: filters.faculty,
		department: filters.department,
		instructor: filters.instructor,
		typeKind: filters.courseType,
		speciality: filters.speciality,
		semesterTerm: filters.semesterTerm,
		semesterYear: filters.semesterYear
			? Number(filters.semesterYear)
			: undefined,
		...(isDifficultyModified && {
			avg_difficulty_min: filters.difficultyRange[0],
			avg_difficulty_max: filters.difficultyRange[1],
		}),
		...(isUsefulnessModified && {
			avg_usefulness_min: filters.usefulnessRange[0],
			avg_usefulness_max: filters.usefulnessRange[1],
		}),
	};

	// Remove empty strings, undefined values, and NaN
	return Object.fromEntries(
		Object.entries(params).filter(
			([_, v]) => v !== "" && v !== undefined && !Number.isNaN(v),
		),
	) as CourseApiFilters;
}

/**
 * Transform sorting state to API query parameters
 */
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

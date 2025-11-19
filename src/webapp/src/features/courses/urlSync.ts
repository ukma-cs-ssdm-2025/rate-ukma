import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "./courseFormatting";
import { DEFAULT_FILTERS, type FilterState } from "./filterSchema";

export function filtersToSearchParams(
	filters: FilterState,
): Record<string, string> {
	const params: Record<string, string> = {};

	if (
		filters.searchQuery &&
		filters.searchQuery !== DEFAULT_FILTERS.searchQuery
	) {
		params.q = filters.searchQuery;
	}

	const [diffMin, diffMax] = filters.difficultyRange;
	const [defaultDiffMin, defaultDiffMax] = DEFAULT_FILTERS.difficultyRange;
	if (diffMin !== defaultDiffMin || diffMax !== defaultDiffMax) {
		params.diff = `${diffMin}-${diffMax}`;
	}

	const [useMin, useMax] = filters.usefulnessRange;
	const [defaultUseMin, defaultUseMax] = DEFAULT_FILTERS.usefulnessRange;
	if (useMin !== defaultUseMin || useMax !== defaultUseMax) {
		params.use = `${useMin}-${useMax}`;
	}

	if (filters.faculty && filters.faculty !== DEFAULT_FILTERS.faculty) {
		params.faculty = filters.faculty;
	}

	if (filters.department && filters.department !== DEFAULT_FILTERS.department) {
		params.dept = filters.department;
	}

	if (filters.instructor && filters.instructor !== DEFAULT_FILTERS.instructor) {
		params.instructor = filters.instructor;
	}

	if (
		filters.semesterTerm &&
		filters.semesterTerm !== DEFAULT_FILTERS.semesterTerm
	) {
		params.term = filters.semesterTerm;
	}

	if (
		filters.semesterYear &&
		filters.semesterYear !== DEFAULT_FILTERS.semesterYear
	) {
		params.year = filters.semesterYear;
	}

	if (filters.courseType && filters.courseType !== DEFAULT_FILTERS.courseType) {
		params.type = filters.courseType;
	}

	if (filters.speciality && filters.speciality !== DEFAULT_FILTERS.speciality) {
		params.spec = filters.speciality;
	}

	return params;
}

function parseRange(rangeStr: string | undefined): [number, number] | null {
	if (!rangeStr) return null;

	const parts = rangeStr.split("-");
	if (parts.length !== 2) return null;

	const min = parseFloat(parts[0]);
	const max = parseFloat(parts[1]);

	if (Number.isNaN(min) || Number.isNaN(max)) return null;

	return [min, max];
}

export function searchParamsToFilters(
	params: Record<string, string>,
): FilterState {
	const filters: FilterState = { ...DEFAULT_FILTERS };

	if (params.q) {
		filters.searchQuery = params.q;
	}

	const diffRange = parseRange(params.diff);
	if (diffRange) {
		const [min, max] = diffRange;
		if (
			min >= DIFFICULTY_RANGE[0] &&
			min <= DIFFICULTY_RANGE[1] &&
			max >= DIFFICULTY_RANGE[0] &&
			max <= DIFFICULTY_RANGE[1] &&
			min <= max
		) {
			filters.difficultyRange = [min, max];
		}
	}

	const useRange = parseRange(params.use);
	if (useRange) {
		const [min, max] = useRange;
		if (
			min >= USEFULNESS_RANGE[0] &&
			min <= USEFULNESS_RANGE[1] &&
			max >= USEFULNESS_RANGE[0] &&
			max <= USEFULNESS_RANGE[1] &&
			min <= max
		) {
			filters.usefulnessRange = [min, max];
		}
	}

	if (params.faculty) {
		filters.faculty = params.faculty;
	}

	if (params.dept) {
		filters.department = params.dept;
	}

	if (params.instructor) {
		filters.instructor = params.instructor;
	}

	if (params.term) {
		filters.semesterTerm = params.term;
	}

	if (params.year) {
		filters.semesterYear = params.year;
	}

	if (params.type) {
		filters.courseType = params.type;
	}

	if (params.spec) {
		filters.speciality = params.spec;
	}

	return filters;
}

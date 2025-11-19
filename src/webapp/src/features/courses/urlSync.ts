import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "./courseFormatting";
import { DEFAULT_FILTERS, type FilterState } from "./filterSchema";

type RangeFilterKey = keyof Pick<
	FilterState,
	"difficultyRange" | "usefulnessRange"
>;
type SimpleFilterKey = keyof Pick<
	FilterState,
	| "searchQuery"
	| "faculty"
	| "department"
	| "instructor"
	| "semesterTerm"
	| "semesterYear"
	| "courseType"
	| "speciality"
>;

const RANGE_PARAM_CONFIG = [
	{ key: "difficultyRange", param: "diff", bounds: DIFFICULTY_RANGE },
	{ key: "usefulnessRange", param: "use", bounds: USEFULNESS_RANGE },
] as const satisfies ReadonlyArray<{
	key: RangeFilterKey;
	param: string;
	bounds: [number, number];
}>;

const SIMPLE_PARAM_CONFIG = [
	{ key: "searchQuery", param: "q" },
	{ key: "faculty", param: "faculty" },
	{ key: "department", param: "dept" },
	{ key: "instructor", param: "instructor" },
	{ key: "semesterTerm", param: "term" },
	{ key: "semesterYear", param: "year" },
	{ key: "courseType", param: "type" },
	{ key: "speciality", param: "spec" },
] as const satisfies ReadonlyArray<{
	key: SimpleFilterKey;
	param: string;
}>;

export function filtersToSearchParams(
	filters: FilterState,
): Record<string, string> {
	const params: Record<string, string> = {};

	for (const { key, param } of RANGE_PARAM_CONFIG) {
		const [currentMin, currentMax] = filters[key];
		const [defaultMin, defaultMax] = DEFAULT_FILTERS[key];

		if (currentMin !== defaultMin || currentMax !== defaultMax) {
			params[param] = `${currentMin}-${currentMax}`;
		}
	}

	for (const { key, param } of SIMPLE_PARAM_CONFIG) {
		const value = filters[key];
		const defaultValue = DEFAULT_FILTERS[key];

		if (value && value !== defaultValue) {
			params[param] = value;
		}
	}

	return params;
}

function parseRange(rangeStr: string | undefined): [number, number] | null {
	if (!rangeStr) return null;

	const parts = rangeStr.split("-");
	if (parts.length !== 2) return null;

	const min = Number.parseFloat(parts[0]);
	const max = Number.parseFloat(parts[1]);

	if (Number.isNaN(min) || Number.isNaN(max)) return null;

	return [min, max];
}

function isRangeWithinBounds(
	range: [number, number],
	bounds: [number, number],
): boolean {
	const [min, max] = range;
	const [minBound, maxBound] = bounds;

	return (
		min >= minBound &&
		min <= maxBound &&
		max >= minBound &&
		max <= maxBound &&
		min <= max
	);
}

export function searchParamsToFilters(
	params: Record<string, string>,
): FilterState {
	const filters: FilterState = { ...DEFAULT_FILTERS };

	for (const { key, param, bounds } of RANGE_PARAM_CONFIG) {
		const range = parseRange(params[param]);
		if (range && isRangeWithinBounds(range, bounds)) {
			filters[key] = range;
		}
	}

	for (const { key, param } of SIMPLE_PARAM_CONFIG) {
		const value = params[param];
		if (value) {
			filters[key] = value;
		}
	}

	return filters;
}

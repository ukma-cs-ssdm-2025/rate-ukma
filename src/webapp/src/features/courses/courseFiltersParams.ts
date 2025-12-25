import {
	createParser,
	parseAsInteger,
	parseAsString,
	parseAsStringEnum,
	useQueryStates,
} from "nuqs";

import type {
	CoursesListSemesterTerm,
	CoursesListTypeKind,
} from "@/lib/api/generated";
import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "./courseFormatting";

const VALID_SEMESTER_TERMS: readonly CoursesListSemesterTerm[] = [
	"FALL",
	"SPRING",
	"SUMMER",
];
const VALID_TYPE_KINDS: readonly CoursesListTypeKind[] = [
	"COMPULSORY",
	"ELECTIVE",
	"PROF_ORIENTED",
];

function createRangeParser(bounds: [number, number]) {
	const [minBound, maxBound] = bounds;

	return createParser({
		parse: (value: string): [number, number] | null => {
			if (!value) return null;

			const [minRaw, maxRaw] = value.split("-");
			if (!minRaw || !maxRaw) return null;

			const min = Number.parseFloat(minRaw);
			const max = Number.parseFloat(maxRaw);
			if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

			if (min < minBound || max > maxBound || min > max) return null;

			return [min, max];
		},
		serialize: (value: [number, number] | null): string => {
			if (!value) return "";

			const [min, max] = value;
			if (!Number.isFinite(min) || !Number.isFinite(max)) return "";
			if (min === minBound && max === maxBound) return "";

			return `${min}-${max}`;
		},
	}).withDefault(bounds);
}

export const courseFiltersParams = {
	q: parseAsString.withDefault(""),
	diff: createRangeParser(DIFFICULTY_RANGE),
	use: createRangeParser(USEFULNESS_RANGE),
	faculty: parseAsString.withDefault(""),
	dept: parseAsString.withDefault(""),
	instructor: parseAsString.withDefault(""),
	term: parseAsStringEnum<CoursesListSemesterTerm>(
		VALID_SEMESTER_TERMS as unknown as CoursesListSemesterTerm[],
	),
	year: parseAsString.withDefault(""),
	type: parseAsStringEnum<CoursesListTypeKind>(
		VALID_TYPE_KINDS as unknown as CoursesListTypeKind[],
	),
	spec: parseAsString.withDefault(""),
	page: parseAsInteger.withDefault(1),
	size: parseAsInteger.withDefault(10),
};

export function useCourseFiltersParams() {
	return useQueryStates(courseFiltersParams, {
		history: "push",
		scroll: false,
		clearOnDefault: true,
	});
}

export type CourseFiltersParamsState = ReturnType<
	typeof useCourseFiltersParams
>[0];

export type CourseFiltersParamsSetter = ReturnType<
	typeof useCourseFiltersParams
>[1];

export const DEFAULT_COURSE_FILTERS_PARAMS: CourseFiltersParamsState = {
	q: "",
	diff: DIFFICULTY_RANGE,
	use: USEFULNESS_RANGE,
	faculty: "",
	dept: "",
	instructor: "",
	term: null,
	year: "",
	type: null,
	spec: "",
	page: 1,
	size: 10,
};

export function courseFiltersStateToSearchParams(
	state: CourseFiltersParamsState,
): Record<string, string | number> {
	const params: Record<string, string | number> = {};

	if (state.q) params.q = state.q;
	if (
		state.diff[0] !== DIFFICULTY_RANGE[0] ||
		state.diff[1] !== DIFFICULTY_RANGE[1]
	) {
		params.diff = `${state.diff[0]}-${state.diff[1]}`;
	}
	if (
		state.use[0] !== USEFULNESS_RANGE[0] ||
		state.use[1] !== USEFULNESS_RANGE[1]
	) {
		params.use = `${state.use[0]}-${state.use[1]}`;
	}
	if (state.faculty) params.faculty = state.faculty;
	if (state.dept) params.dept = state.dept;
	if (state.instructor) params.instructor = state.instructor;
	if (state.term) params.term = state.term;
	if (state.year) params.year = state.year;
	if (state.type) params.type = state.type;
	if (state.spec) params.spec = state.spec;
	if (state.page !== 1) params.page = state.page;
	if (state.size !== 10) params.size = state.size;

	return params;
}

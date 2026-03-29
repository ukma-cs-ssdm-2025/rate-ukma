import * as React from "react";

import { EducationLevelEnum, type FilterOptions } from "@/lib/api/generated";
import type { CourseFiltersParamsState } from "../courseFiltersParams";
import {
	CREDITS_RANGE,
	DIFFICULTY_RANGE,
	getCourseTypeDisplay,
	getEducationLevelDisplay,
	getSemesterTermDisplay,
	USEFULNESS_RANGE,
} from "../courseFormatting";

const SEMESTER_TERM_ORDER = ["FALL", "SPRING", "SUMMER"];
export function areFiltersActive(params: CourseFiltersParamsState): boolean {
	return (
		params.q !== "" ||
		params.diff[0] !== DIFFICULTY_RANGE[0] ||
		params.diff[1] !== DIFFICULTY_RANGE[1] ||
		params.use[0] !== USEFULNESS_RANGE[0] ||
		params.use[1] !== USEFULNESS_RANGE[1] ||
		params.faculty !== "" ||
		params.dept !== "" ||
		params.instructor !== "" ||
		params.term.length > 0 ||
		params.year !== "" ||
		params.credits[0] !== CREDITS_RANGE[0] ||
		params.credits[1] !== CREDITS_RANGE[1] ||
		params.type !== null ||
		params.spec !== "" ||
		params.eduLevel !== null ||
		params.page !== 1 ||
		params.size !== 10
	);
}

type SelectOption = {
	value: string;
	label: string;
};

export type SelectFilterConfig = {
	key: string;
	label: string;
	placeholder: string;
	value: string;
	options: SelectOption[];
	contentClassName?: string;
	useCombobox?: boolean;
	disabled?: boolean;
	disabledMessage?: string;
};

export type RangeFilterConfig = {
	key: "diff" | "use" | "credits";
	label: string;
	value: [number, number];
	range: [number, number];
	captions: [string, string];
	disabled?: boolean;
	disabledMessage?: string;
};

export type SemesterTermToggle = {
	options: Array<{ value: string; label: string }>;
	selected: string[];
};

export type FilterPresetId = "easy" | "most-useful";

export type FilterPreset = {
	id: FilterPresetId;
	label: string;
	expandsGroup?: "rating" | "semester" | "structure";
};

export const FILTER_PRESETS: readonly FilterPreset[] = [
	{ id: "easy", label: "Легкі курси", expandsGroup: "rating" },
	{ id: "most-useful", label: "Найкорисніші", expandsGroup: "rating" },
];

export function getPresetFilters(
	presetId: FilterPresetId,
): Partial<CourseFiltersParamsState> {
	switch (presetId) {
		case "easy":
			return { diff: [DIFFICULTY_RANGE[0], 2.5] };
		case "most-useful":
			return { use: [4, USEFULNESS_RANGE[1]] };
	}
}

export function getPresetResetFilters(
	presetId: FilterPresetId,
): Partial<CourseFiltersParamsState> {
	switch (presetId) {
		case "easy":
			return { diff: DIFFICULTY_RANGE };
		case "most-useful":
			return { use: USEFULNESS_RANGE };
	}
}

export type EducationLevelToggle = {
	options: Array<{ value: string; label: string }>;
	selected: string;
};

export type FilterGroupConfig = {
	id: "rating" | "semester" | "structure";
	label: string;
	activeCount: number;
};

export type CourseFiltersData = {
	groups: {
		rating: {
			config: FilterGroupConfig;
			rangeFilters: RangeFilterConfig[];
		};
		semester: {
			config: FilterGroupConfig;
			semesterTermToggle: SemesterTermToggle;
			selectFilters: SelectFilterConfig[];
			rangeFilters: RangeFilterConfig[];
		};
		structure: {
			config: FilterGroupConfig;
			educationLevelToggle: EducationLevelToggle;
			selectFilters: SelectFilterConfig[];
		};
	};
	presets: readonly FilterPreset[];
	activePresetIds: FilterPresetId[];
	hasActiveFilters: boolean;
};

export function useCourseFiltersData({
	params,
	filterOptions,
}: {
	params: CourseFiltersParamsState;
	filterOptions?: FilterOptions;
}): CourseFiltersData {
	const filters = params;

	const {
		faculties = [],
		semester_terms: semesterTerms = [],
		semester_years: semesterYears = [],
		course_types: courseTypes = [],
	} = filterOptions ?? {};

	// Extract all departments and specialities from nested faculty structure
	const allDepartments = React.useMemo(
		() => faculties.flatMap((faculty) => faculty.departments || []),
		[faculties],
	);

	const allSpecialities = React.useMemo(
		() => faculties.flatMap((faculty) => faculty.specialities || []),
		[faculties],
	);

	const filteredDepartments = React.useMemo(() => {
		if (!filters.faculty) {
			return allDepartments;
		}

		const selectedFaculty = faculties.find((f) => f.id === filters.faculty);
		return selectedFaculty?.departments || [];
	}, [faculties, filters.faculty, allDepartments]);

	const filteredSpecialities = React.useMemo(() => {
		if (!filters.faculty) {
			return allSpecialities;
		}

		const selectedFaculty = faculties.find((f) => f.id === filters.faculty);
		return selectedFaculty?.specialities || [];
	}, [faculties, filters.faculty, allSpecialities]);

	const ratingRangeFilters: RangeFilterConfig[] = [
		{
			key: "diff",
			label: "Складність",
			value: filters.diff,
			range: DIFFICULTY_RANGE,
			captions: ["Легко", "Складно"],
		},
		{
			key: "use",
			label: "Корисність",
			value: filters.use,
			range: USEFULNESS_RANGE,
			captions: ["Низька", "Висока"],
		},
	];

	const semesterRangeFilters: RangeFilterConfig[] = [
		{
			key: "credits",
			label: "Кредити ECTS",
			value: filters.credits,
			range: CREDITS_RANGE,
			captions: ["Менше", "Більше"],
			disabled: !filters.year,
			disabledMessage: filters.year
				? undefined
				: "Спочатку оберіть навчальний рік",
		},
	];

	const semesterTermToggleOptions = React.useMemo(
		() =>
			[...semesterTerms]
				.sort(
					(a, b) =>
						SEMESTER_TERM_ORDER.indexOf(a.value) -
						SEMESTER_TERM_ORDER.indexOf(b.value),
				)
				.map((term) => ({
					value: term.value,
					label: getSemesterTermDisplay(term.value, term.label),
				})),
		[semesterTerms],
	);

	const semesterSelectFilters: SelectFilterConfig[] = React.useMemo(
		() => [
			{
				key: "year",
				label: "Навчальний рік",
				placeholder: "Усі навчальні роки",
				value: filters.year,
				options: semesterYears.map((year) => ({
					value: year.value,
					label: year.label ?? year.value,
				})),
			},
		],
		[semesterYears, filters.year],
	);

	const educationLevelToggleOptions: EducationLevelToggle = React.useMemo(
		() => ({
			options: [
				{
					value: EducationLevelEnum.BACHELOR,
					label: getEducationLevelDisplay(EducationLevelEnum.BACHELOR),
				},
				{
					value: EducationLevelEnum.MASTER,
					label: getEducationLevelDisplay(EducationLevelEnum.MASTER),
				},
			],
			selected: filters.eduLevel ?? "",
		}),
		[filters.eduLevel],
	);

	const structureSelectFilters: SelectFilterConfig[] = React.useMemo(
		() => [
			{
				key: "faculty",
				label: "Факультет",
				placeholder: "Усі факультети",
				value: filters.faculty,
				options: [
					{ value: "", label: "Усі факультети" },
					...faculties.map((faculty) => ({
						value: faculty.id,
						label: faculty.name,
					})),
				],
				useCombobox: true,
			},
			{
				key: "dept",
				label: "Кафедра",
				placeholder: "Усі кафедри",
				value: filters.dept,
				options: [
					{ value: "", label: "Усі кафедри" },
					...filteredDepartments.map((department) => ({
						value: department.id,
						label: department.name,
					})),
				],
				useCombobox: true,
			},
			{
				key: "spec",
				label: "Спеціальність",
				placeholder: "Усі спеціальності",
				value: filters.spec,
				options: [
					{ value: "", label: "Усі спеціальності" },
					...filteredSpecialities.map((speciality) => ({
						value: speciality.id,
						label: speciality.name,
					})),
				],
				contentClassName: "max-h-72",
				useCombobox: true,
			},
			{
				key: "type",
				label: "Тип курсу",
				placeholder: "Усі типи курсів",
				value: filters.type ?? "",
				options: courseTypes.map((type) => ({
					value: type.value,
					label: getCourseTypeDisplay(type.value, type.label),
				})),
				disabled: !filters.spec,
				disabledMessage: filters.spec
					? undefined
					: "Спочатку оберіть спеціальність",
			},
		],
		[
			courseTypes,
			faculties,
			filteredDepartments,
			filteredSpecialities,
			filters.faculty,
			filters.dept,
			filters.spec,
			filters.type,
		],
	);

	const ratingActiveCount = React.useMemo(() => {
		let count = 0;
		if (
			filters.diff[0] !== DIFFICULTY_RANGE[0] ||
			filters.diff[1] !== DIFFICULTY_RANGE[1]
		)
			count++;
		if (
			filters.use[0] !== USEFULNESS_RANGE[0] ||
			filters.use[1] !== USEFULNESS_RANGE[1]
		)
			count++;
		return count;
	}, [filters.diff, filters.use]);

	const semesterActiveCount = React.useMemo(() => {
		let count = 0;
		if (filters.year) count++;
		if (filters.term.length > 0) count++;
		if (
			filters.credits[0] !== CREDITS_RANGE[0] ||
			filters.credits[1] !== CREDITS_RANGE[1]
		)
			count++;
		return count;
	}, [filters.year, filters.term, filters.credits]);

	const structureActiveCount = React.useMemo(() => {
		let count = 0;
		if (filters.faculty) count++;
		if (filters.dept) count++;
		if (filters.spec) count++;
		if (filters.type) count++;
		if (filters.eduLevel) count++;
		return count;
	}, [
		filters.faculty,
		filters.dept,
		filters.spec,
		filters.type,
		filters.eduLevel,
	]);

	const activePresetIds = React.useMemo(() => {
		const ids: FilterPresetId[] = [];

		if (filters.diff[0] === DIFFICULTY_RANGE[0] && filters.diff[1] === 2.5) {
			ids.push("easy");
		}

		if (filters.use[0] === 4 && filters.use[1] === USEFULNESS_RANGE[1]) {
			ids.push("most-useful");
		}

		return ids;
	}, [filters.diff, filters.use]);

	return {
		groups: {
			rating: {
				config: {
					id: "rating",
					label: "Рейтинг",
					activeCount: ratingActiveCount,
				},
				rangeFilters: ratingRangeFilters,
			},
			semester: {
				config: {
					id: "semester",
					label: "Семестр",
					activeCount: semesterActiveCount,
				},
				semesterTermToggle: {
					options: semesterTermToggleOptions,
					selected: filters.term,
				},
				selectFilters: semesterSelectFilters,
				rangeFilters: semesterRangeFilters,
			},
			structure: {
				config: {
					id: "structure",
					label: "Структура",
					activeCount: structureActiveCount,
				},
				educationLevelToggle: educationLevelToggleOptions,
				selectFilters: structureSelectFilters,
			},
		},
		presets: FILTER_PRESETS,
		activePresetIds,
		hasActiveFilters: areFiltersActive(params),
	};
}

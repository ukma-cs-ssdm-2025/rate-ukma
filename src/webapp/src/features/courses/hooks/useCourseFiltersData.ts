import * as React from "react";

import type { FilterOptions } from "@/lib/api/generated";
import type { CourseFiltersParamsState } from "../courseFiltersParams";
import {
	DIFFICULTY_RANGE,
	formatDecimalValue,
	getCourseTypeDisplay,
	getFacultyAbbreviation,
	getSemesterTermDisplay,
	USEFULNESS_RANGE,
} from "../courseFormatting";

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
		params.term !== null ||
		params.year !== "" ||
		params.type !== null ||
		params.spec !== "" ||
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
	tooltip?: string;
};

export type RangeFilterConfig = {
	key: "diff" | "use";
	label: string;
	value: [number, number];
	range: [number, number];
	captions: [string, string];
};

export type CourseFiltersData = {
	rangeFilters: RangeFilterConfig[];
	selectFilters: SelectFilterConfig[];
	activeBadges: Array<{ key: string; label: string }>;
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
		instructors = [],
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

	const selectedFacultyOption = React.useMemo(
		() => faculties.find((option) => option.id === filters.faculty),
		[faculties, filters.faculty],
	);

	const selectedDepartmentOption = React.useMemo(
		() => allDepartments.find((option) => option.id === filters.dept),
		[allDepartments, filters.dept],
	);

	const selectedSemesterTermOption = React.useMemo(
		() => semesterTerms.find((option) => option.value === filters.term) ?? null,
		[semesterTerms, filters.term],
	);

	const selectedSemesterYearOption = React.useMemo(
		() => semesterYears.find((option) => option.value === filters.year) ?? null,
		[semesterYears, filters.year],
	);

	const selectedInstructorOption = React.useMemo(
		() => instructors.find((option) => option.id === filters.instructor),
		[instructors, filters.instructor],
	);

	const selectedCourseTypeOption = React.useMemo(
		() => courseTypes.find((option) => option.value === filters.type),
		[courseTypes, filters.type],
	);

	const selectedSpecialityOption = React.useMemo(
		() => allSpecialities.find((option) => option.id === filters.spec),
		[allSpecialities, filters.spec],
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

	const rangeFilters: RangeFilterConfig[] = [
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

	const selectFilters: SelectFilterConfig[] = React.useMemo(
		() => [
			{
				key: "term",
				label: "Семестровий період",
				placeholder: "Усі періоди",
				value: filters.term ?? "",
				options: semesterTerms.map((term) => ({
					value: term.value,
					label: getSemesterTermDisplay(term.value, term.label),
				})),
			},
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
				tooltip: filters.spec
					? undefined
					: "Оберіть спеціальність, щоб обрати тип курсу",
			},
			// {
			// 	key: "instructor",
			// 	label: "Викладач",
			// 	placeholder: "Усі викладачі",
			// 	value: filters.instructor,
			// 	options: instructors.map((instructor) => ({
			// 		value: instructor.id,
			// 		label: instructor.name,
			// 	})),
			// 	contentClassName: "max-h-72",
			// }, // unstable backend data
		],
		[
			courseTypes,
			faculties,
			filteredDepartments,
			filteredSpecialities,
			// instructors, // unstable backend data - commented out from selectFilters
			semesterTerms,
			semesterYears,
			filters.term,
			filters.year,
			filters.faculty,
			filters.dept,
			filters.spec,
			filters.type,
			// filters.instructor, // unstable backend data - commented out from selectFilters
		],
	);

	const activeBadges = React.useMemo(() => {
		const badges: Array<{ key: string; label: string }> = [];

		if (filters.q) {
			badges.push({ key: "search", label: `Пошук: ${filters.q}` });
		}

		if (
			filters.diff[0] !== DIFFICULTY_RANGE[0] ||
			filters.diff[1] !== DIFFICULTY_RANGE[1]
		) {
			badges.push({
				key: "difficulty",
				label: `${formatDecimalValue(filters.diff[0], { fallback: "0" })}-${formatDecimalValue(filters.diff[1], { fallback: "0" })} складність`,
			});
		}

		if (
			filters.use[0] !== USEFULNESS_RANGE[0] ||
			filters.use[1] !== USEFULNESS_RANGE[1]
		) {
			badges.push({
				key: "usefulness",
				label: `${formatDecimalValue(filters.use[0], { fallback: "0" })}-${formatDecimalValue(filters.use[1], { fallback: "0" })} корисність`,
			});
		}

		const semesterTermLabel = selectedSemesterTermOption
			? getSemesterTermDisplay(
					selectedSemesterTermOption.value,
					selectedSemesterTermOption.label,
				)
			: null;

		if (selectedSemesterYearOption && semesterTermLabel) {
			badges.push({
				key: "semester",
				label: `${selectedSemesterYearOption.label} ${semesterTermLabel}`,
			});
		} else if (semesterTermLabel) {
			badges.push({
				key: "semesterTerm",
				label: semesterTermLabel,
			});
		} else if (selectedSemesterYearOption) {
			badges.push({
				key: "semesterYear",
				label: selectedSemesterYearOption.label,
			});
		}

		if (selectedFacultyOption) {
			badges.push({
				key: "faculty",
				label:
					selectedFacultyOption.custom_abbreviation ||
					getFacultyAbbreviation(selectedFacultyOption.name),
			});
		}

		if (selectedDepartmentOption) {
			badges.push({
				key: "department",
				label: selectedDepartmentOption.name,
			});
		}

		if (selectedSpecialityOption) {
			badges.push({
				key: "speciality",
				label: selectedSpecialityOption.name,
			});
		}

		if (selectedCourseTypeOption) {
			badges.push({
				key: "courseType",
				label: getCourseTypeDisplay(
					selectedCourseTypeOption.value,
					selectedCourseTypeOption.label,
				),
			});
		}

		if (selectedInstructorOption) {
			badges.push({
				key: "instructor",
				label: selectedInstructorOption.name,
			});
		}

		return badges;
	}, [
		filters,
		selectedCourseTypeOption,
		selectedDepartmentOption,
		selectedFacultyOption,
		selectedInstructorOption,
		selectedSemesterTermOption,
		selectedSemesterYearOption,
		selectedSpecialityOption,
	]);

	return {
		rangeFilters,
		selectFilters,
		activeBadges,
		hasActiveFilters: areFiltersActive(params),
	};
}

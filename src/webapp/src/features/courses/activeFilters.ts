import type { CoursesListTypeKind, FilterOptions } from "@/lib/api/generated";
import { getSemesterTermDisplay } from "@/lib/semester-term";
import type { CourseFiltersParamsState } from "./courseFiltersParams";
import {
	CREDITS_RANGE,
	DIFFICULTY_RANGE,
	formatDecimalValue,
	getEducationLevelDisplay,
	USEFULNESS_RANGE,
} from "./courseFormatting";

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

type ActiveFilterChip = {
	key: string;
	label: string;
	clear: Partial<CourseFiltersParamsState>;
};

export function getActiveFilterChips(
	params: CourseFiltersParamsState,
	filterOptions?: FilterOptions,
): ActiveFilterChip[] {
	const chips: ActiveFilterChip[] = [];

	if (
		params.diff[0] !== DIFFICULTY_RANGE[0] ||
		params.diff[1] !== DIFFICULTY_RANGE[1]
	) {
		chips.push({
			key: "diff",
			label: `Складність ${formatDecimalValue(params.diff[0])}–${formatDecimalValue(params.diff[1])}`,
			clear: { diff: DIFFICULTY_RANGE },
		});
	}

	if (
		params.use[0] !== USEFULNESS_RANGE[0] ||
		params.use[1] !== USEFULNESS_RANGE[1]
	) {
		chips.push({
			key: "use",
			label: `Корисність ${formatDecimalValue(params.use[0])}–${formatDecimalValue(params.use[1])}`,
			clear: { use: USEFULNESS_RANGE },
		});
	}

	if (params.year) {
		const yearLabel =
			filterOptions?.semester_years.find((year) => year.value === params.year)
				?.label ?? params.year;
		chips.push({
			key: "year",
			label: yearLabel,
			clear: { year: "", credits: CREDITS_RANGE },
		});
	}

	for (const term of params.term) {
		chips.push({
			key: `term-${term}`,
			label: getSemesterTermDisplay(term),
			clear: { term: params.term.filter((active) => active !== term) },
		});
	}

	if (params.eduLevel) {
		chips.push({
			key: "eduLevel",
			label: getEducationLevelDisplay(params.eduLevel),
			clear: { eduLevel: null },
		});
	}

	const faculties = filterOptions?.faculties ?? [];
	if (params.faculty) {
		chips.push({
			key: "faculty",
			label:
				faculties.find((faculty) => faculty.id === params.faculty)?.name ??
				params.faculty,
			clear: { faculty: "", dept: "" },
		});
	}

	if (params.dept) {
		const departments = faculties.flatMap(
			(faculty) => faculty.departments ?? [],
		);
		chips.push({
			key: "dept",
			label:
				departments.find((department) => department.id === params.dept)?.name ??
				params.dept,
			clear: { dept: "" },
		});
	}

	if (params.spec) {
		const specialities = faculties.flatMap(
			(faculty) => faculty.specialities ?? [],
		);
		chips.push({
			key: "spec",
			label:
				specialities.find((speciality) => speciality.id === params.spec)
					?.name ?? params.spec,
			clear: { spec: "", type: null },
		});
	}

	if (params.type) {
		chips.push({
			key: "type",
			label: COURSE_TYPE_FILTER_LABELS[params.type],
			clear: { type: null },
		});
	}

	if (params.instructor) {
		chips.push({
			key: "instructor",
			label:
				filterOptions?.instructors.find(
					(instructor) => instructor.id === params.instructor,
				)?.name ?? "Викладач",
			clear: { instructor: "" },
		});
	}

	if (
		params.credits[0] !== CREDITS_RANGE[0] ||
		params.credits[1] !== CREDITS_RANGE[1]
	) {
		chips.push({
			key: "credits",
			label: `Кредити ${formatDecimalValue(params.credits[0])}–${formatDecimalValue(params.credits[1])}`,
			clear: { credits: CREDITS_RANGE },
		});
	}

	return chips;
}

export const COURSE_TYPE_FILTER_LABELS = {
	COMPULSORY: "Обов'язкові",
	PROF_ORIENTED: "Професійно-орієнтовані",
	ELECTIVE: "Вільного вибору",
} satisfies Record<CoursesListTypeKind, string>;

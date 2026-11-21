import { useCallback } from "react";

import { Separator } from "@/components/ui/Separator";
import { useAuth } from "@/lib/auth/useAuth";
import { testIds } from "@/lib/test-ids";
import {
	parseEducationLevel,
	parseSemesterTerms,
	parseTypeKind,
} from "../courseFiltersParams";
import type { CourseFiltersParamsState } from "../courseFiltersParams";
import { CREDITS_RANGE } from "../courseFormatting";
import type {
	CourseFiltersData,
	SelectFilterKey,
} from "../hooks/useCourseFiltersData";
import {
	CourseTypeToggleControl,
	EducationLevelToggleControl,
	FilterSection,
	RangeFilters,
	SelectFilters,
	SemesterTermToggleControl,
} from "./CourseFilterControls";

export function CourseFiltersContent({
	params,
	setParams,
	data,
}: Readonly<{
	params: CourseFiltersParamsState;
	setParams: (updates: Partial<CourseFiltersParamsState>) => void;
	data: CourseFiltersData;
}>) {
	const setWithPageReset = useCallback(
		(updates: Partial<CourseFiltersParamsState>) => {
			setParams({ ...updates, page: 1 });
		},
		[setParams],
	);

	const latestYear = data.groups.semester.selectFilters
		.find((filter) => filter.key === "year")
		?.options.map((option) => option.value)
		.sort()
		.at(-1);

	const handleRangeChange = useCallback(
		(key: "diff" | "use" | "credits", value: [number, number]) => {
			if (key === "credits") {
				setWithPageReset(
					params.year || !latestYear
						? { credits: value }
						: { credits: value, year: latestYear },
				);
			} else if (key === "diff") {
				setWithPageReset({ diff: value });
			} else {
				setWithPageReset({ use: value });
			}
		},
		[setWithPageReset, params.year, latestYear],
	);

	const handleTermToggle = useCallback(
		(values: string[]) => {
			setWithPageReset({
				term: parseSemesterTerms(values),
			});
		},
		[setWithPageReset],
	);

	const getSelectValue = useCallback(
		(key: SelectFilterKey): string => {
			switch (key) {
				case "year":
					return params.year;
				case "faculty":
					return params.faculty;
				case "dept":
					return params.dept;
				case "instructor":
					return params.instructor;
				case "spec":
					return params.spec;
				case "type":
					return params.type ?? "";
			}
		},
		[
			params.year,
			params.faculty,
			params.dept,
			params.instructor,
			params.spec,
			params.type,
		],
	);

	const handleSelectChange = useCallback(
		(key: SelectFilterKey, value: string) => {
			switch (key) {
				case "year":
					setWithPageReset({
						year: value,
						credits: value ? params.credits : CREDITS_RANGE,
					});
					return;
				case "faculty":
					setWithPageReset({ faculty: value, dept: "" });
					return;
				case "dept":
					setWithPageReset({ dept: value });
					return;
				case "spec":
					setWithPageReset({
						spec: value,
						type: value ? params.type : null,
					});
					return;
				case "instructor":
					setWithPageReset({ instructor: value });
					return;
				case "type":
					setWithPageReset({
						type: parseTypeKind(value),
					});
					return;
			}
		},
		[setWithPageReset, params.credits, params.type],
	);

	const handleEducationLevelToggle = useCallback(
		(value: string) => {
			setWithPageReset({
				eduLevel: parseEducationLevel(value),
			});
		},
		[setWithPageReset],
	);

	const { groups } = data;
	const { speciality: ownSpeciality } = useAuth();

	const semesterSelect = groups.semester.selectFilters.find(
		(filter) => filter.key === "year",
	);
	const facultySelects = groups.structure.selectFilters.filter((filter) =>
		["faculty", "dept"].includes(filter.key),
	);
	const specialitySelect = groups.structure.selectFilters.find(
		(filter) => filter.key === "spec",
	);
	const typeSelect = groups.structure.selectFilters.find(
		(filter) => filter.key === "type",
	);
	const instructorSelect = groups.structure.selectFilters.find(
		(filter) => filter.key === "instructor",
	);

	return (
		<div className="space-y-6">
			<FilterSection
				label="Спеціальність і тип дисципліни"
				testId={testIds.filters.groupStructure}
			>
				{specialitySelect && (
					<div className="space-y-1.5">
						<SelectFilters
							filters={[specialitySelect]}
							getSelectValue={getSelectValue}
							onSelectChange={handleSelectChange}
						/>
						{ownSpeciality && params.spec !== ownSpeciality.id && (
							<button
								type="button"
								className="text-left text-xs text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
								onClick={() =>
									setWithPageReset({ spec: ownSpeciality.id, type: null })
								}
							>
								Обрати мою: {ownSpeciality.name}
							</button>
						)}
					</div>
				)}
				{typeSelect && (
					<CourseTypeToggleControl
						filter={typeSelect}
						value={params.type ?? ""}
						disabled={!params.spec && !ownSpeciality}
						onChange={(value) => {
							if (!params.spec && ownSpeciality && value) {
								setWithPageReset({
									spec: ownSpeciality.id,
									type: parseTypeKind(value),
								});
								return;
							}
							handleSelectChange("type", value);
						}}
					/>
				)}
			</FilterSection>

			<Separator />

			<FilterSection label="Семестр" testId={testIds.filters.groupSemester}>
				{semesterSelect && (
					<SelectFilters
						filters={[semesterSelect]}
						getSelectValue={getSelectValue}
						onSelectChange={handleSelectChange}
					/>
				)}
				<SemesterTermToggleControl
					toggle={groups.semester.semesterTermToggle}
					onTermToggle={handleTermToggle}
				/>
				<RangeFilters
					filters={groups.semester.rangeFilters}
					params={params}
					onRangeChange={handleRangeChange}
				/>
			</FilterSection>

			<FilterSection
				label="Оцінки дисципліни"
				testId={testIds.filters.groupRating}
			>
				<RangeFilters
					filters={groups.rating.rangeFilters}
					params={params}
					onRangeChange={handleRangeChange}
				/>
			</FilterSection>

			<Separator />

			<FilterSection label="Факультет і кафедра">
				<SelectFilters
					filters={facultySelects}
					getSelectValue={getSelectValue}
					onSelectChange={handleSelectChange}
				/>
				<EducationLevelToggleControl
					toggle={groups.structure.educationLevelToggle}
					onToggle={handleEducationLevelToggle}
				/>
				{instructorSelect && (
					<SelectFilters
						filters={[instructorSelect]}
						getSelectValue={getSelectValue}
						onSelectChange={handleSelectChange}
					/>
				)}
			</FilterSection>
		</div>
	);
}

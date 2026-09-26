import { memo, useCallback, useEffect, useState } from "react";

import { X } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Label } from "@/components/ui/Label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
import { Separator } from "@/components/ui/Separator";
import { Slider } from "@/components/ui/Slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";
import { InstructorFilterSelect } from "@/features/instructors/components/InstructorFilterSelect";
import type {
	CoursesListSemesterTermsItem,
	CoursesListTypeKind,
	EducationLevelEnum,
	FilterOptions,
} from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { CourseFiltersPanelSkeleton } from "./CourseFiltersPanelSkeleton";
import type { CourseFiltersParamsState } from "../courseFiltersParams";
import { CREDITS_RANGE, formatDecimalValue } from "../courseFormatting";
import {
	areFiltersActive,
	COURSE_TYPE_FILTER_LABELS,
	type CourseFiltersData,
	type EducationLevelToggle,
	type RangeFilterConfig,
	type SelectFilterConfig,
	type SemesterTermToggle,
	useCourseFiltersData,
} from "../hooks/useCourseFiltersData";

interface CourseFiltersBaseProps {
	readonly params: CourseFiltersParamsState;
	readonly setParams: (updates: Partial<CourseFiltersParamsState>) => void;
	readonly filterOptions?: FilterOptions;
}

interface CourseFiltersPanelProps extends CourseFiltersBaseProps {
	readonly onReset: () => void;
	readonly isLoading?: boolean;
	readonly className?: string;
}

export interface CourseFiltersDrawerProps extends CourseFiltersBaseProps {
	readonly onReset: () => void;
	readonly onClose: () => void;
	readonly isLoading?: boolean;
	readonly className?: string;
}

// --- Primitive filter controls ---

function FilterSlider({
	label,
	value,
	range,
	step = 0.1,
	testId,
	disabled,
	disabledMessage,
	onValueChange,
}: Readonly<{
	label: string;
	value: [number, number];
	range: [number, number];
	step?: number;
	testId?: string;
	disabled?: boolean;
	disabledMessage?: string;
	onValueChange: (value: [number, number]) => void;
}>) {
	const [localValue, setLocalValue] = useState(value);

	useEffect(() => {
		setLocalValue((currentValue) =>
			currentValue[0] === value[0] && currentValue[1] === value[1]
				? currentValue
				: value,
		);
	}, [value]);

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-2">
				<Label className="text-sm font-medium">{label}</Label>
				<span className="text-sm text-muted-foreground tabular-nums">
					{formatDecimalValue(localValue[0], { fallback: "0" })}–
					{formatDecimalValue(localValue[1], { fallback: "0" })}
				</span>
			</div>
			<Slider
				min={range[0]}
				max={range[1]}
				step={step}
				value={localValue}
				onValueChange={(val) => {
					setLocalValue(val as [number, number]);
				}}
				onValueCommit={(val) => onValueChange(val as [number, number])}
				disabled={disabled}
				data-testid={testId}
				thumbLabels={[`${label}, від`, `${label}, до`]}
				className="w-full py-2"
			/>
			{/* A slider that can be disabled keeps its hint line, so enabling it moves nothing below. */}
			{disabled === undefined ? null : (
				<p className="min-h-4 text-xs text-muted-foreground">
					{disabledMessage}
				</p>
			)}
		</div>
	);
}

function FilterSection({
	title,
	activeCount,
	testId,
	children,
}: Readonly<{
	title: string;
	activeCount?: number;
	testId?: string;
	children: React.ReactNode;
}>) {
	return (
		<section className="space-y-3" data-testid={testId}>
			<div className="flex h-6 items-center gap-2">
				<h3 className="text-sm font-semibold">{title}</h3>
				{activeCount != null && activeCount > 0 && (
					<Badge variant="soft">{activeCount}</Badge>
				)}
			</div>
			<div className="space-y-4">{children}</div>
		</section>
	);
}

// --- Select/Range rendering helpers ---

const RANGE_FILTER_TEST_IDS: Record<string, string> = {
	diff: testIds.filters.difficultySlider,
	use: testIds.filters.usefulnessSlider,
	credits: testIds.filters.creditsSelect,
};

const SELECT_FILTER_TEST_IDS: Record<string, string> = {
	year: testIds.filters.yearSelect,
	faculty: testIds.filters.facultySelect,
	dept: testIds.filters.departmentSelect,
	spec: testIds.filters.specialitySelect,
	type: testIds.filters.typeSelect,
	instructor: testIds.filters.instructorSelect,
};

function RangeFilters({
	filters,
	params,
	onRangeChange,
}: Readonly<{
	filters: RangeFilterConfig[];
	params: CourseFiltersParamsState;
	onRangeChange: (
		key: "diff" | "use" | "credits",
		value: [number, number],
	) => void;
}>) {
	return (
		<>
			{filters.map(({ key, ...filter }) => (
				<FilterSlider
					key={key}
					{...filter}
					testId={RANGE_FILTER_TEST_IDS[key]}
					value={params[key]}
					onValueChange={(next) => onRangeChange(key, next)}
				/>
			))}
		</>
	);
}

function SemesterTermToggleControl({
	toggle,
	onTermToggle,
}: Readonly<{
	toggle: SemesterTermToggle;
	onTermToggle: (values: string[]) => void;
}>) {
	if (toggle.options.length === 0) return null;

	return (
		<div className="space-y-3">
			<Label className="text-sm font-medium">Семестровий період</Label>
			<ToggleGroup
				type="multiple"
				variant="outline"
				value={toggle.selected}
				onValueChange={onTermToggle}
				className="flex w-full"
				data-testid={testIds.filters.termToggle}
				role="group"
			>
				{toggle.options.map((option) => (
					<ToggleGroupItem
						key={option.value}
						value={option.value}
						className={cn(
							"flex-1",
							option.value === "FALL" &&
								"data-[state=on]:bg-term-fall/12 data-[state=on]:text-term-fall",
							option.value === "SPRING" &&
								"data-[state=on]:bg-term-spring/12 data-[state=on]:text-term-spring",
							option.value === "SUMMER" &&
								"data-[state=on]:bg-term-summer/12 data-[state=on]:text-term-summer",
						)}
					>
						{option.label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</div>
	);
}

const COURSE_TYPE_ORDER = ["COMPULSORY", "PROF_ORIENTED", "ELECTIVE"];

function CourseTypeToggleControl({
	filter,
	value,
	onChange,
}: Readonly<{
	filter: SelectFilterConfig;
	value: string;
	onChange: (value: string) => void;
}>) {
	const options = [...filter.options].sort(
		(a, b) =>
			COURSE_TYPE_ORDER.indexOf(a.value) - COURSE_TYPE_ORDER.indexOf(b.value),
	);
	if (options.length === 0) return null;

	return (
		<div className="space-y-3">
			<Label className="text-sm font-medium">{filter.label}</Label>
			<ToggleGroup
				type="single"
				variant="outline"
				value={value}
				onValueChange={onChange}
				disabled={filter.disabled}
				spacing={1.5}
				className="w-full flex-wrap"
				data-testid={testIds.filters.typeSelect}
			>
				{options.map((option) => (
					<ToggleGroupItem
						key={option.value}
						value={option.value}
						className="flex-none px-3 data-[state=on]:border-primary/30 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
					>
						{COURSE_TYPE_FILTER_LABELS[option.value] ?? option.label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
			{filter.disabledMessage && (
				<p className="text-xs text-muted-foreground">
					{filter.disabledMessage}
				</p>
			)}
		</div>
	);
}

function EducationLevelToggleControl({
	toggle,
	onToggle,
}: Readonly<{
	toggle: EducationLevelToggle;
	onToggle: (value: string) => void;
}>) {
	if (toggle.options.length === 0) return null;

	return (
		<div className="space-y-3">
			<Label className="text-sm font-medium">Освітній рівень</Label>
			<ToggleGroup
				type="single"
				variant="outline"
				value={toggle.selected}
				onValueChange={onToggle}
				className="flex w-full"
				data-testid={testIds.filters.educationLevelToggle}
			>
				{toggle.options.map((option) => (
					<ToggleGroupItem
						key={option.value}
						value={option.value}
						className="flex-1"
					>
						{option.label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</div>
	);
}

function SelectFilters({
	filters,
	getSelectValue,
	onSelectChange,
}: Readonly<{
	filters: SelectFilterConfig[];
	getSelectValue: (key: string) => string;
	onSelectChange: (key: string, value: string) => void;
}>) {
	return (
		<>
			{filters.map(
				({
					key,
					label,
					placeholder,
					options,
					contentClassName,
					useCombobox,
					disabled,
					disabledMessage,
				}) => {
					const currentValue = getSelectValue(key);
					const testId = SELECT_FILTER_TEST_IDS[key];
					const isDisabled = disabled || options.length === 0;
					// Named in place, so enabling the field moves nothing below it.
					const shownPlaceholder = disabledMessage ?? placeholder;

					if (key === "instructor") {
						return (
							<div key={key} className="space-y-2">
								<Label className="text-sm font-medium">{label}</Label>
								<InstructorFilterSelect
									value={currentValue}
									onChange={(nextValue) => onSelectChange(key, nextValue)}
									placeholder={placeholder}
									data-testid={testId}
									mentionedOnly
								/>
							</div>
						);
					}

					const selectElement = useCombobox ? (
						<Combobox
							options={options}
							value={currentValue}
							onValueChange={(nextValue) => {
								onSelectChange(key, nextValue);
							}}
							placeholder={shownPlaceholder}
							searchPlaceholder="Пошук..."
							emptyText="Нічого не знайдено."
							disabled={isDisabled}
							contentClassName={contentClassName}
							data-testid={testId}
						/>
					) : (
						<Select
							value={currentValue || "all"}
							onValueChange={(nextValue) => {
								const newValue = nextValue === "all" ? "" : nextValue;
								onSelectChange(key, newValue);
							}}
							disabled={isDisabled}
						>
							<SelectTrigger className="w-full" data-testid={testId}>
								<SelectValue placeholder={shownPlaceholder} />
							</SelectTrigger>
							<SelectContent
								className={contentClassName}
								data-testid={testId ? `${testId}-content` : undefined}
							>
								<SelectItem value="all">{shownPlaceholder}</SelectItem>
								{options.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					);

					return (
						<div key={key} className="space-y-2">
							<Label className="text-sm font-medium">{label}</Label>
							{selectElement}
						</div>
					);
				},
			)}
		</>
	);
}

// --- Main content ---

function CourseFiltersContent({
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

	const handleRangeChange = useCallback(
		(key: "diff" | "use" | "credits", value: [number, number]) => {
			if (key === "credits") {
				setWithPageReset({ credits: value });
			} else if (key === "diff") {
				setWithPageReset({ diff: value });
			} else {
				setWithPageReset({ use: value });
			}
		},
		[setWithPageReset],
	);

	const handleTermToggle = useCallback(
		(values: string[]) => {
			setWithPageReset({
				term: values as CoursesListSemesterTermsItem[],
			});
		},
		[setWithPageReset],
	);

	const getSelectValue = useCallback(
		(key: string): string => {
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
				default:
					return "";
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
		(key: string, value: string) => {
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
						type: (value || null) as CoursesListTypeKind | null,
					});
					return;
			}
		},
		[setWithPageReset, setParams, params.credits, params.type],
	);

	const handleEducationLevelToggle = useCallback(
		(value: string) => {
			setWithPageReset({
				eduLevel: (value || null) as EducationLevelEnum | null,
			});
		},
		[setWithPageReset],
	);

	const { groups } = data;
	const specialityCount = (params.spec ? 1 : 0) + (params.type ? 1 : 0);
	const structureCount =
		(params.faculty ? 1 : 0) +
		(params.dept ? 1 : 0) +
		(params.eduLevel ? 1 : 0);

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
			{/* Students filter by their own programme far more than by faculty or
			    department, so speciality and course type lead. */}
			<FilterSection
				title="Моя спеціальність"
				activeCount={specialityCount}
				testId={testIds.filters.groupStructure}
			>
				{specialitySelect && (
					<SelectFilters
						filters={[specialitySelect]}
						getSelectValue={getSelectValue}
						onSelectChange={handleSelectChange}
					/>
				)}
				{typeSelect && (
					<CourseTypeToggleControl
						filter={typeSelect}
						value={params.type ?? ""}
						onChange={(value) => handleSelectChange("type", value)}
					/>
				)}
			</FilterSection>

			<Separator />

			<FilterSection
				title="Оцінки курсу"
				activeCount={groups.rating.config.activeCount}
				testId={testIds.filters.groupRating}
			>
				<RangeFilters
					filters={groups.rating.rangeFilters}
					params={params}
					onRangeChange={handleRangeChange}
				/>
			</FilterSection>

			<Separator />

			<FilterSection
				title="Семестр"
				activeCount={groups.semester.config.activeCount}
				testId={testIds.filters.groupSemester}
			>
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

			<Separator />

			<FilterSection title="Факультет і кафедра" activeCount={structureCount}>
				<SelectFilters
					filters={facultySelects}
					getSelectValue={getSelectValue}
					onSelectChange={handleSelectChange}
				/>
				<EducationLevelToggleControl
					toggle={groups.structure.educationLevelToggle}
					onToggle={handleEducationLevelToggle}
				/>
			</FilterSection>

			{instructorSelect && (
				<>
					<Separator />
					<SelectFilters
						filters={[instructorSelect]}
						getSelectValue={getSelectValue}
						onSelectChange={handleSelectChange}
					/>
				</>
			)}
		</div>
	);
}

function getTotalActiveCount(data: CourseFiltersData): number {
	return (
		data.groups.rating.config.activeCount +
		data.groups.semester.config.activeCount +
		data.groups.structure.config.activeCount
	);
}

function FiltersHeading({ count }: Readonly<{ count: number }>) {
	return (
		<>
			Фільтри
			{count > 0 && <Badge variant="soft">{count}</Badge>}
		</>
	);
}

function ResetButton({ onReset }: Readonly<{ onReset: () => void }>) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onClick={onReset}
			data-testid={testIds.filters.resetButton}
		>
			Скинути
		</Button>
	);
}

function FiltersHeader({
	count,
	hasActiveFilters,
	onReset,
}: Readonly<{
	count: number;
	hasActiveFilters: boolean;
	onReset: () => void;
}>) {
	return (
		<div className="flex min-h-10 items-center justify-between gap-2">
			<div className="flex items-center gap-2 text-sm font-semibold">
				<FiltersHeading count={count} />
			</div>
			{hasActiveFilters && <ResetButton onReset={onReset} />}
		</div>
	);
}

export const CourseFiltersPanel = memo(function CourseFiltersPanel({
	onReset,
	isLoading,
	className,
	...baseProps
}: Readonly<CourseFiltersPanelProps>) {
	const data = useCourseFiltersData(baseProps);
	const hasActiveFilters = areFiltersActive(baseProps.params);

	if (isLoading) {
		return <CourseFiltersPanelSkeleton />;
	}

	const totalActive = getTotalActiveCount(data);

	return (
		<aside
			className={cn("sticky top-22 space-y-3", className)}
			data-testid={testIds.filters.panel}
		>
			<FiltersHeader
				count={totalActive}
				hasActiveFilters={hasActiveFilters}
				onReset={onReset}
			/>
			<CourseFiltersContent
				params={baseProps.params}
				setParams={baseProps.setParams}
				data={data}
			/>
		</aside>
	);
});

export const CourseFiltersDrawer = memo(function CourseFiltersDrawer({
	onReset,
	isLoading,
	onClose,
	className,
	...baseProps
}: Readonly<CourseFiltersDrawerProps>) {
	const data = useCourseFiltersData(baseProps);
	const hasActiveFilters = areFiltersActive(baseProps.params);

	if (isLoading) {
		return <CourseFiltersPanelSkeleton />;
	}

	const totalActive = getTotalActiveCount(data);

	return (
		<div
			className={cn("flex h-full min-h-0 flex-col", className)}
			data-testid={testIds.filters.drawer}
		>
			<div className="flex min-h-10 items-center justify-between gap-2">
				<span className="flex items-center gap-2 text-sm font-semibold">
					<FiltersHeading count={totalActive} />
				</span>
				<div className="flex items-center gap-1">
					{hasActiveFilters && <ResetButton onReset={onReset} />}
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						aria-label="Закрити фільтри"
						data-testid={testIds.filters.drawerCloseButton}
					>
						<X className="size-4" />
					</Button>
				</div>
			</div>
			<div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-2">
				<CourseFiltersContent
					params={baseProps.params}
					setParams={baseProps.setParams}
					data={data}
				/>
			</div>
			<div className="flex items-center justify-between gap-2 border-t border-border pt-4">
				<Button type="button" variant="ghost" onClick={onReset}>
					Скинути
				</Button>
				<Button type="button" onClick={onClose}>
					Показати
				</Button>
			</div>
		</div>
	);
});

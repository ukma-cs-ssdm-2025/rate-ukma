import { memo, useCallback, useEffect, useState } from "react";

import { ChevronDown, X } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
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
import { ActiveFilterChips } from "./ActiveFilterChips";
import { CourseFiltersPanelSkeleton } from "./CourseFiltersPanelSkeleton";
import type { CourseFiltersParamsState } from "../courseFiltersParams";
import { CREDITS_RANGE, formatDecimalValue } from "../courseFormatting";
import {
	areFiltersActive,
	type CourseFiltersData,
	type EducationLevelToggle,
	type FilterPreset,
	type FilterPresetId,
	getPresetFilters,
	getPresetResetFilters,
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
	readonly variant?: "card" | "plain";
	readonly showTitle?: boolean;
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
				className="w-full"
			/>
			{disabledMessage && (
				<p className="text-xs text-muted-foreground">{disabledMessage}</p>
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
			<div className="flex items-center gap-2">
				<h3 className="text-sm font-medium">{title}</h3>
				{activeCount != null && activeCount > 0 && (
					<Badge variant="soft">{activeCount}</Badge>
				)}
			</div>
			<div className="space-y-4">{children}</div>
		</section>
	);
}

// --- Presets ---

function FilterPresets({
	presets,
	activePresetIds,
	onTogglePreset,
}: Readonly<{
	presets: readonly FilterPreset[];
	activePresetIds: FilterPresetId[];
	onTogglePreset: (presetId: FilterPresetId) => void;
}>) {
	return (
		<div
			className="flex flex-wrap gap-2"
			data-testid={testIds.filters.presetsSection}
		>
			{presets.map((preset) => {
				const isActive = activePresetIds.includes(preset.id);
				return (
					<Button
						key={preset.id}
						type="button"
						variant="outline"
						size="sm"
						aria-pressed={isActive}
						onClick={() => onTogglePreset(preset.id)}
						className={cn(
							isActive &&
								"border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
						)}
						data-testid={testIds.filters.presetButton}
					>
						{preset.label}
					</Button>
				);
			})}
		</div>
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
							placeholder={placeholder}
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
								<SelectValue placeholder={placeholder} />
							</SelectTrigger>
							<SelectContent
								className={contentClassName}
								data-testid={testId ? `${testId}-content` : undefined}
							>
								<SelectItem value="all">{placeholder}</SelectItem>
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
							{disabledMessage && (
								<p className="text-xs text-muted-foreground">
									{disabledMessage}
								</p>
							)}
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
	const moreActive = params.instructor !== "" || params.type !== null;
	const [moreOpen, setMoreOpen] = useState(moreActive);

	useEffect(() => {
		if (moreActive) setMoreOpen(true);
	}, [moreActive]);

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
					setParams({
						faculty: value,
						dept: "",
						spec: "",
						type: null,
						page: 1,
					});
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

	const handleTogglePreset = useCallback(
		(presetId: FilterPresetId) => {
			const isActive = data.activePresetIds.includes(presetId);

			if (isActive) {
				setWithPageReset(getPresetResetFilters(presetId));
			} else {
				setWithPageReset(getPresetFilters(presetId));
			}
		},
		[data.activePresetIds, setWithPageReset],
	);

	const { groups } = data;
	const moreCount =
		(params.instructor !== "" ? 1 : 0) + (params.type !== null ? 1 : 0);
	const moreExpanded = moreOpen;

	const semesterSelect = groups.semester.selectFilters.find(
		(filter) => filter.key === "year",
	);
	const facultySelects = groups.structure.selectFilters.filter((filter) =>
		["faculty", "dept", "spec"].includes(filter.key),
	);
	const typeSelect = groups.structure.selectFilters.find(
		(filter) => filter.key === "type",
	);
	const instructorSelect = groups.structure.selectFilters.find(
		(filter) => filter.key === "instructor",
	);

	return (
		<div className="space-y-6">
			<FilterPresets
				presets={data.presets}
				activePresetIds={data.activePresetIds}
				onTogglePreset={handleTogglePreset}
			/>

			<FilterSection
				title="Оцінки"
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

			<FilterSection
				title="Навчання"
				activeCount={
					groups.structure.config.activeCount -
					(params.instructor !== "" ? 1 : 0) -
					(params.type !== null ? 1 : 0)
				}
				testId={testIds.filters.groupStructure}
			>
				<EducationLevelToggleControl
					toggle={groups.structure.educationLevelToggle}
					onToggle={handleEducationLevelToggle}
				/>
				<SelectFilters
					filters={facultySelects}
					getSelectValue={getSelectValue}
					onSelectChange={handleSelectChange}
				/>
			</FilterSection>

			<Collapsible open={moreExpanded} onOpenChange={setMoreOpen}>
				<CollapsibleTrigger asChild>
					<button
						type="button"
						className="flex w-full items-center justify-between py-1 text-sm font-medium"
					>
						<span className="flex items-center gap-2">
							Більше фільтрів
							{moreCount > 0 && <Badge variant="soft">{moreCount}</Badge>}
						</span>
						<ChevronDown
							className={cn(
								"size-4 text-muted-foreground transition-transform duration-200",
								moreExpanded && "rotate-180",
							)}
						/>
					</button>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<div className="space-y-4 pt-4 pb-1">
						{instructorSelect && (
							<SelectFilters
								filters={[instructorSelect]}
								getSelectValue={getSelectValue}
								onSelectChange={handleSelectChange}
							/>
						)}
						{typeSelect && (
							<SelectFilters
								filters={[typeSelect]}
								getSelectValue={getSelectValue}
								onSelectChange={handleSelectChange}
							/>
						)}
					</div>
				</CollapsibleContent>
			</Collapsible>
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
	variant = "card",
	showTitle = true,
	...baseProps
}: Readonly<CourseFiltersPanelProps>) {
	const data = useCourseFiltersData(baseProps);
	const hasActiveFilters = areFiltersActive(baseProps.params);

	if (isLoading) {
		return <CourseFiltersPanelSkeleton />;
	}

	if (variant === "plain" && !showTitle && !hasActiveFilters) {
		return (
			<div className={cn("space-y-6", className)}>
				<CourseFiltersContent
					params={baseProps.params}
					setParams={baseProps.setParams}
					data={data}
				/>
			</div>
		);
	}

	const totalActive = getTotalActiveCount(data);

	return (
		<aside
			className={cn("sticky top-6 space-y-3", className)}
			data-testid={testIds.filters.panel}
		>
			<FiltersHeader
				count={totalActive}
				hasActiveFilters={hasActiveFilters}
				onReset={onReset}
			/>
			<ActiveFilterChips
				params={baseProps.params}
				setParams={baseProps.setParams}
				filterOptions={baseProps.filterOptions}
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

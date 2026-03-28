import { memo, useCallback, useEffect, useState } from "react";

import {
	Building2,
	CalendarDays,
	ChevronDown,
	Filter,
	Info,
	Star,
	X,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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
import { Slider } from "@/components/ui/Slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import type {
	CoursesListSemesterTermsItem,
	CoursesListTypeKind,
	EducationLevelEnum,
	FilterOptions,
} from "@/lib/api/generated";
import { localStorageAdapter } from "@/lib/storage";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { CourseFiltersPanelSkeleton } from "./CourseFiltersPanelSkeleton";
import type { CourseFiltersParamsState } from "../courseFiltersParams";
import { CREDITS_RANGE, formatDecimalValue } from "../courseFormatting";
import {
	areFiltersActive,
	type EducationLevelToggle,
	type FilterGroupConfig,
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

function InfoHint({ message }: Readonly<{ message: string }>) {
	return (
		<Tooltip delayDuration={0}>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label={message}
					className="shrink-0 text-muted-foreground"
				>
					<Info className="h-3.5 w-3.5" aria-hidden="true" />
				</button>
			</TooltipTrigger>
			<TooltipContent side="top" sideOffset={4}>
				<p>{message}</p>
			</TooltipContent>
		</Tooltip>
	);
}

function FilterSlider({
	label,
	value,
	range,
	captions,
	testId,
	disabled,
	disabledMessage,
	onValueChange,
}: Readonly<{
	label: string;
	value: [number, number];
	range: [number, number];
	captions: [string, string];
	testId?: string;
	disabled?: boolean;
	disabledMessage?: string;
	onValueChange: (value: [number, number]) => void;
}>) {
	const [localValue, setLocalValue] = useState(value);

	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	return (
		<div className="space-y-3">
			<Label className="text-sm font-medium inline-flex items-center gap-1.5">
				{label}: {formatDecimalValue(localValue[0], { fallback: "0" })} -{" "}
				{formatDecimalValue(localValue[1], { fallback: "0" })}
				{disabledMessage && <InfoHint message={disabledMessage} />}
			</Label>
			<Slider
				min={range[0]}
				max={range[1]}
				step={0.1}
				value={localValue}
				onValueChange={(val) => setLocalValue(val as [number, number])}
				onValueCommit={(val) => onValueChange(val as [number, number])}
				disabled={disabled}
				data-testid={testId}
				className="w-full"
			/>
			<div className="flex justify-between text-xs text-muted-foreground">
				<span>{captions[0]}</span>
				<span>{captions[1]}</span>
			</div>
		</div>
	);
}

// --- Filter Group ---

const GROUP_ICONS: Record<string, React.ElementType> = {
	rating: Star,
	semester: CalendarDays,
	structure: Building2,
};

const STORAGE_KEY_FILTER_GROUPS = "filters:open-groups";

function FilterGroup({
	config,
	open,
	onOpenChange,
	testId,
	children,
}: Readonly<{
	config: FilterGroupConfig;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	testId?: string;
	children: React.ReactNode;
}>) {
	const Icon = GROUP_ICONS[config.id];

	return (
		<Collapsible open={open} onOpenChange={onOpenChange}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="flex w-full items-center justify-between py-2.5 text-sm font-semibold hover:text-foreground/80 transition-colors"
					data-testid={testId}
				>
					<span className="flex items-center gap-2">
						{Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
						{config.label}
						{config.activeCount > 0 && (
							<Badge
								variant="secondary"
								className="h-5 min-w-5 px-1.5 text-[10px]"
							>
								{config.activeCount}
							</Badge>
						)}
					</span>
					<ChevronDown
						className={cn(
							"h-4 w-4 text-muted-foreground transition-transform duration-200",
							open && "rotate-180",
						)}
					/>
				</button>
			</CollapsibleTrigger>
			<CollapsibleContent className="space-y-4 pt-2 pb-1">
				{children}
			</CollapsibleContent>
		</Collapsible>
	);
}

// --- Presets ---

function FilterPresets({
	presets,
	activePresetIds,
	onTogglePreset,
}: Readonly<{
	presets: ReturnType<typeof useCourseFiltersData>["presets"];
	activePresetIds: FilterPresetId[];
	onTogglePreset: (presetId: FilterPresetId) => void;
}>) {
	return (
		<div
			className="flex flex-wrap gap-1.5"
			data-testid={testIds.filters.presetsSection}
		>
			{presets.map((preset) => {
				const isActive = activePresetIds.includes(preset.id);
				return (
					<button
						key={preset.id}
						type="button"
						onClick={() => onTogglePreset(preset.id)}
						className={cn(
							"inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
							isActive
								? "border-primary bg-primary/10 text-primary"
								: "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
						)}
						data-testid={testIds.filters.presetButton}
					>
						{preset.label}
					</button>
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
			>
				{toggle.options.map((option) => (
					<ToggleGroupItem
						key={option.value}
						value={option.value}
						className="flex-1 text-xs"
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
						className="flex-1 text-xs"
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
						<div key={key} className="space-y-3">
							<Label className="text-sm font-medium inline-flex items-center gap-1.5">
								{label}
								{disabledMessage && <InfoHint message={disabledMessage} />}
							</Label>
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
	data: ReturnType<typeof useCourseFiltersData>;
}>) {
	const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
		const stored = localStorageAdapter.getItem<Record<string, boolean>>(
			STORAGE_KEY_FILTER_GROUPS,
		);
		return stored ?? { rating: true, semester: true, structure: true };
	});

	const setGroupOpen = useCallback((groupId: string, open: boolean) => {
		setOpenGroups((prev) => {
			const next = { ...prev, [groupId]: open };
			localStorageAdapter.setItem(STORAGE_KEY_FILTER_GROUPS, next);
			return next;
		});
	}, []);

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

				const preset = data.presets.find((p) => p.id === presetId);
				if (preset?.expandsGroup) {
					setGroupOpen(preset.expandsGroup, true);
				}
			}
		},
		[data.activePresetIds, data.presets, setWithPageReset, setGroupOpen],
	);

	const { groups } = data;

	return (
		<div className="space-y-4">
			<FilterPresets
				presets={data.presets}
				activePresetIds={data.activePresetIds}
				onTogglePreset={handleTogglePreset}
			/>

			<div className="space-y-1 divide-y">
				<FilterGroup
					config={groups.rating.config}
					open={openGroups.rating}
					onOpenChange={(open) => setGroupOpen("rating", open)}
					testId={testIds.filters.groupRating}
				>
					<RangeFilters
						filters={groups.rating.rangeFilters}
						params={params}
						onRangeChange={handleRangeChange}
					/>
				</FilterGroup>

				<FilterGroup
					config={groups.semester.config}
					open={openGroups.semester}
					onOpenChange={(open) => setGroupOpen("semester", open)}
					testId={testIds.filters.groupSemester}
				>
					<SelectFilters
						filters={groups.semester.selectFilters}
						getSelectValue={getSelectValue}
						onSelectChange={handleSelectChange}
					/>
					<SemesterTermToggleControl
						toggle={groups.semester.semesterTermToggle}
						onTermToggle={handleTermToggle}
					/>
					<RangeFilters
						filters={groups.semester.rangeFilters}
						params={params}
						onRangeChange={handleRangeChange}
					/>
				</FilterGroup>

				<FilterGroup
					config={groups.structure.config}
					open={openGroups.structure}
					onOpenChange={(open) => setGroupOpen("structure", open)}
					testId={testIds.filters.groupStructure}
				>
					<EducationLevelToggleControl
						toggle={groups.structure.educationLevelToggle}
						onToggle={handleEducationLevelToggle}
					/>
					<SelectFilters
						filters={groups.structure.selectFilters}
						getSelectValue={getSelectValue}
						onSelectChange={handleSelectChange}
					/>
				</FilterGroup>
			</div>
		</div>
	);
}

// --- Reset button ---

function ResetButton({ onReset }: Readonly<{ onReset: () => void }>) {
	return (
		<button
			type="button"
			onClick={onReset}
			className="text-sm text-muted-foreground hover:text-foreground transition-colors"
			data-testid={testIds.filters.resetButton}
		>
			Скинути
		</button>
	);
}

// --- Panel variants ---

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

	if (variant === "plain") {
		const showHeader = showTitle || hasActiveFilters;
		return (
			<div className={cn("space-y-6", className)}>
				{showHeader && (
					<div className="flex items-center justify-between">
						{showTitle && (
							<div className="flex items-center gap-2 text-sm font-semibold">
								<Filter className="h-4 w-4" />
								<span>Фільтри</span>
							</div>
						)}
						{hasActiveFilters && <ResetButton onReset={onReset} />}
					</div>
				)}
				<CourseFiltersContent
					params={baseProps.params}
					setParams={baseProps.setParams}
					data={data}
				/>
			</div>
		);
	}

	return (
		<Card
			className={cn("sticky top-6", className)}
			data-testid={testIds.filters.panel}
		>
			<CardHeader className="pb-4">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg flex items-center gap-2">
						<Filter className="h-5 w-5" />
						Фільтри
					</CardTitle>
					{hasActiveFilters && <ResetButton onReset={onReset} />}
				</div>
			</CardHeader>
			<CardContent>
				<CourseFiltersContent
					params={baseProps.params}
					setParams={baseProps.setParams}
					data={data}
				/>
			</CardContent>
		</Card>
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

	return (
		<div
			className={cn("space-y-6", className)}
			data-testid={testIds.filters.drawer}
		>
			<div className="flex items-center justify-between">
				<span className="text-lg font-semibold">Фільтри</span>
				<div className="flex items-center gap-2">
					{hasActiveFilters && <ResetButton onReset={onReset} />}
					<Button
						variant="ghost"
						size="icon"
						className="h-9 w-9 rounded-full p-0"
						onClick={onClose}
						aria-label="Закрити фільтри"
						data-testid={testIds.filters.drawerCloseButton}
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</div>
			<CourseFiltersContent
				params={baseProps.params}
				setParams={baseProps.setParams}
				data={data}
			/>
		</div>
	);
});

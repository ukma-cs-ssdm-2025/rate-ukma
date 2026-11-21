import { useEffect, useState } from "react";

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
import { InstructorFilterSelect } from "@/features/instructors/components/InstructorFilterSelect";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import type { CourseFiltersParamsState } from "../courseFiltersParams";
import { formatDecimalValue } from "../courseFormatting";
import type {
	EducationLevelToggle,
	RangeFilterConfig,
	SelectFilterConfig,
	SelectFilterKey,
	SemesterTermToggle,
} from "../hooks/useCourseFiltersData";

function toRange(
	value: readonly number[],
	bounds: readonly [number, number],
): [number, number] {
	return [value[0] ?? bounds[0], value[1] ?? bounds[1]];
}

function FilterSlider({
	label,
	value,
	range,
	step = 0.1,
	testId,
	onValueChange,
}: Readonly<{
	label: string;
	value: [number, number];
	range: [number, number];
	step?: number;
	testId?: string;
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
				onValueChange={(val) => setLocalValue(toRange(val, range))}
				onValueCommit={(val) => onValueChange(toRange(val, range))}
				data-testid={testId}
				thumbLabels={[`${label}, від`, `${label}, до`]}
				className="w-full py-2"
			/>
		</div>
	);
}

export function FilterSection({
	label,
	testId,
	children,
}: Readonly<{
	label: string;
	testId?: string;
	children: React.ReactNode;
}>) {
	return (
		<div
			role="group"
			aria-label={label}
			className="space-y-4"
			data-testid={testId}
		>
			{children}
		</div>
	);
}

const RANGE_FILTER_TEST_IDS = {
	diff: testIds.filters.difficultySlider,
	use: testIds.filters.usefulnessSlider,
	credits: testIds.filters.creditsSelect,
} satisfies Record<RangeFilterConfig["key"], string>;

const SELECT_FILTER_TEST_IDS = {
	year: testIds.filters.yearSelect,
	faculty: testIds.filters.facultySelect,
	dept: testIds.filters.departmentSelect,
	spec: testIds.filters.specialitySelect,
	type: testIds.filters.typeSelect,
	instructor: testIds.filters.instructorSelect,
} satisfies Record<SelectFilterKey, string>;

export function RangeFilters({
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

export function SemesterTermToggleControl({
	toggle,
	onTermToggle,
}: Readonly<{
	toggle: SemesterTermToggle;
	onTermToggle: (values: string[]) => void;
}>) {
	if (toggle.options.length === 0) {
		return null;
	}

	return (
		<div className="space-y-3">
			<Label className="text-sm font-medium">Семестр</Label>
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

export function CourseTypeToggleControl({
	filter,
	value,
	disabled,
	onChange,
}: Readonly<{
	filter: SelectFilterConfig;
	value: string;
	disabled: boolean;
	onChange: (value: string) => void;
}>) {
	const options = [...filter.options].sort(
		(a, b) =>
			COURSE_TYPE_ORDER.indexOf(a.value) - COURSE_TYPE_ORDER.indexOf(b.value),
	);
	if (options.length === 0) {
		return null;
	}

	return (
		<div className="space-y-3">
			<Label className="text-sm font-medium">{filter.label}</Label>
			<ToggleGroup
				type="single"
				variant="outline"
				value={value}
				onValueChange={onChange}
				disabled={disabled}
				className="flex w-full items-stretch"
				data-testid={testIds.filters.typeSelect}
			>
				{options.map((option) => (
					<ToggleGroupItem
						key={option.value}
						value={option.value}
						className="h-auto min-h-9 flex-1 px-1.5 py-1.5 text-xs leading-tight whitespace-normal"
					>
						{option.label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
			{disabled && filter.disabledMessage && (
				<p className="text-xs text-muted-foreground">
					{filter.disabledMessage}
				</p>
			)}
		</div>
	);
}

export function EducationLevelToggleControl({
	toggle,
	onToggle,
}: Readonly<{
	toggle: EducationLevelToggle;
	onToggle: (value: string) => void;
}>) {
	if (toggle.options.length === 0) {
		return null;
	}

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

export function SelectFilters({
	filters,
	getSelectValue,
	onSelectChange,
}: Readonly<{
	filters: SelectFilterConfig[];
	getSelectValue: (key: SelectFilterKey) => string;
	onSelectChange: (key: SelectFilterKey, value: string) => void;
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

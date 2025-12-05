import { memo, useEffect, useState } from "react";

import { Filter, X } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { Controller, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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
import type { FilterOptions } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { CourseFiltersPanelSkeleton } from "./CourseFiltersPanelSkeleton";
import { formatDecimalValue } from "../courseFormatting";
import type { FilterState } from "../filterSchema";
import {
	areFiltersActive,
	useCourseFiltersData,
} from "../hooks/useCourseFiltersData";

interface CourseFiltersBaseProps {
	readonly form: UseFormReturn<FilterState>;
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

interface CourseFiltersContentProps {
	readonly form: UseFormReturn<FilterState>;
	readonly data: ReturnType<typeof useCourseFiltersData>;
}

function FilterSlider({
	label,
	value,
	range,
	captions,
	onValueChange,
}: Readonly<{
	label: string;
	value: [number, number];
	range: [number, number];
	captions: [string, string];
	onValueChange: (value: [number, number]) => void;
}>) {
	const [localValue, setLocalValue] = useState(value);

	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	return (
		<div className="space-y-3">
			<Label className="text-sm font-medium">
				{label}: {formatDecimalValue(localValue[0], { fallback: "0" })} -{" "}
				{formatDecimalValue(localValue[1], { fallback: "0" })}
			</Label>
			<Slider
				min={range[0]}
				max={range[1]}
				step={0.1}
				value={localValue}
				onValueChange={(val) => setLocalValue(val as [number, number])}
				onValueCommit={(val) => onValueChange(val as [number, number])}
				className="w-full"
			/>
			<div className="flex justify-between text-xs text-muted-foreground">
				<span>{captions[0]}</span>
				<span>{captions[1]}</span>
			</div>
		</div>
	);
}

function useHasActiveFilters(form: UseFormReturn<FilterState>): boolean {
	const filters = useWatch({ control: form.control });
	return areFiltersActive(filters as FilterState);
}

function ActiveFilters({
	badges,
}: Readonly<{
	badges: Array<{ key: string; label: string }>;
}>) {
	if (badges.length === 0) {
		return null;
	}

	return (
		<div className="pt-4 border-t space-y-2">
			<div className="text-xs font-medium text-muted-foreground">
				Активні фільтри:
			</div>
			<div className="flex flex-wrap gap-2">
				{badges.map((badge) => (
					<Badge
						key={badge.key}
						variant="secondary"
						className="text-xs whitespace-normal h-auto py-1 break-words"
					>
						{badge.label}
					</Badge>
				))}
			</div>
		</div>
	);
}

function CourseFiltersContent({
	form,
	data,
}: Readonly<CourseFiltersContentProps>) {
	return (
		<div className="space-y-6">
			{data.rangeFilters.map(({ key, ...filter }) => (
				<Controller
					key={key}
					control={form.control}
					name={key as keyof FilterState}
					render={({ field }) => (
						<FilterSlider
							{...filter}
							value={field.value as [number, number]}
							onValueChange={(next) => {
								field.onChange(next);
							}}
						/>
					)}
				/>
			))}

			{data.selectFilters.map(
				({
					key,
					label,
					placeholder,
					options,
					contentClassName,
					useCombobox,
				}) => (
					<Controller
						key={key}
						control={form.control}
						name={key as keyof FilterState}
						render={({ field }) => (
							<div className="space-y-3">
								<Label className="text-sm font-medium">{label}</Label>
								{useCombobox ? (
									<Combobox
										options={options}
										value={(field.value as string) || ""}
										onValueChange={(nextValue) => {
											field.onChange(nextValue);
											// Clear department when faculty changes
											if (key === "faculty" && field.value !== nextValue) {
												form.setValue("department", "", { shouldDirty: true });
											}
										}}
										placeholder={placeholder}
										searchPlaceholder="Пошук..."
										emptyText="Нічого не знайдено."
										disabled={options.length === 0}
										contentClassName={contentClassName}
									/>
								) : (
									<Select
										value={(field.value as string) || "all"}
										onValueChange={(nextValue) => {
											const newValue = nextValue === "all" ? "" : nextValue;
											field.onChange(newValue);

											// Clear department when faculty changes
											if (key === "faculty" && field.value !== newValue) {
												form.setValue("department", "", { shouldDirty: true });
											}
										}}
										disabled={options.length === 0}
									>
										<SelectTrigger className="w-full">
											<SelectValue placeholder={placeholder} />
										</SelectTrigger>
										<SelectContent className={contentClassName}>
											<SelectItem value="all">{placeholder}</SelectItem>
											{options.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							</div>
						)}
					/>
				),
			)}

			<ActiveFilters badges={data.activeBadges} />
		</div>
	);
}

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

export const CourseFiltersPanel = memo(function CourseFiltersPanel({
	onReset,
	isLoading,
	className,
	variant = "card",
	showTitle = true,
	...baseProps
}: Readonly<CourseFiltersPanelProps>) {
	const data = useCourseFiltersData(baseProps);
	const hasActiveFilters = useHasActiveFilters(baseProps.form);

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
				<CourseFiltersContent form={baseProps.form} data={data} />
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
				<CourseFiltersContent form={baseProps.form} data={data} />
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
	const hasActiveFilters = useHasActiveFilters(baseProps.form);

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
			<CourseFiltersContent form={baseProps.form} data={data} />
		</div>
	);
});

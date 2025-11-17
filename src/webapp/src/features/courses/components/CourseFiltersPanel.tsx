import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import { Filter, X } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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
import { cn } from "@/lib/utils";
import { CourseFiltersPanelSkeleton } from "./CourseFiltersPanelSkeleton";
import type { FilterState } from "../filterSchema";
import { useCourseFiltersData } from "../hooks/useCourseFiltersData";

interface CourseFiltersBaseProps {
	form: UseFormReturn<FilterState>;
	filterOptions?: FilterOptions;
}

interface CourseFiltersPanelProps extends CourseFiltersBaseProps {
	onReset: () => void;
	isLoading?: boolean;
	className?: string;
}

export interface CourseFiltersDrawerProps extends CourseFiltersBaseProps {
	onReset: () => void;
	onClose: () => void;
	isLoading?: boolean;
	className?: string;
}

interface CourseFiltersContentProps {
	form: UseFormReturn<FilterState>;
	data: ReturnType<typeof useCourseFiltersData>;
}

function CourseFiltersContent({
	form,
	data,
}: Readonly<CourseFiltersContentProps>) {
	return (
		<div className="space-y-6">
			{data.rangeFilters.map(({ key, label, value, range, captions }) => (
				<div key={key} className="space-y-3">
					<Label className="text-sm font-medium">
						{label}: {value[0].toFixed(1)} - {value[1].toFixed(1)}
					</Label>
					<Slider
						min={range[0]}
						max={range[1]}
						step={0.1}
						value={value}
						onValueChange={(next) =>
							form.setValue(key, next as [number, number], {
								shouldDirty: true,
							})
						}
						className="w-full"
					/>
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>{captions[0]}</span>
						<span>{captions[1]}</span>
					</div>
				</div>
			))}

			{data.selectFilters.map(
				({ key, label, placeholder, value, options, contentClassName }) => (
					<div key={key} className="space-y-3">
						<Label className="text-sm font-medium">{label}</Label>
						<Select
							value={value || "all"}
							onValueChange={(nextValue) => {
								const newValue = nextValue === "all" ? "" : nextValue;
								form.setValue(
									key as keyof FilterState,
									newValue as FilterState[keyof FilterState],
									{ shouldDirty: true },
								);

								// Clear department when faculty changes
								if (key === "faculty" && nextValue !== value) {
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
					</div>
				),
			)}

			{data.hasActiveFilters && (
				<div className="pt-4 border-t space-y-2">
					<div className="text-xs font-medium text-muted-foreground">
						Активні фільтри:
					</div>
					<div className="flex flex-wrap gap-2">
						{data.activeBadges.map((badge) => (
							<Badge key={badge.key} variant="secondary" className="text-xs">
								{badge.label}
							</Badge>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function ResetButton({ onReset }: Readonly<{ onReset: () => void }>) {
	return (
		<button
			type="button"
			onClick={onReset}
			className="text-sm text-muted-foreground hover:text-foreground transition-colors"
		>
			Скинути
		</button>
	);
}

export function CourseFiltersPanel({
	onReset,
	isLoading,
	className,
	...baseProps
}: Readonly<CourseFiltersPanelProps>) {
	const data = useCourseFiltersData(baseProps);

	if (isLoading) {
		return <CourseFiltersPanelSkeleton />;
	}

	return (
		<Card className={cn("sticky top-6", className)}>
			<CardHeader className="pb-4">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg flex items-center gap-2">
						<Filter className="h-5 w-5" />
						Фільтри
					</CardTitle>
					{data.hasActiveFilters && <ResetButton onReset={onReset} />}
				</div>
			</CardHeader>
			<CardContent>
				<CourseFiltersContent form={baseProps.form} data={data} />
			</CardContent>
		</Card>
	);
}

export function CourseFiltersDrawer({
	onReset,
	isLoading,
	onClose,
	className,
	...baseProps
}: Readonly<CourseFiltersDrawerProps>) {
	const data = useCourseFiltersData(baseProps);

	if (isLoading) {
		return <CourseFiltersPanelSkeleton />;
	}

	return (
		<div className={cn("space-y-6", className)}>
			<div className="flex items-center justify-between">
				<span className="text-lg font-semibold">Фільтри</span>
				<div className="flex items-center gap-2">
					{data.hasActiveFilters && <ResetButton onReset={onReset} />}
					<Button
						variant="ghost"
						size="icon"
						className="h-9 w-9 rounded-full p-0"
						onClick={onClose}
						aria-label="Закрити фільтри"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</div>
			<CourseFiltersContent form={baseProps.form} data={data} />
		</div>
	);
}

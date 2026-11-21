import { memo } from "react";

import { X } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Separator } from "@/components/ui/Separator";
import { Skeleton } from "@/components/ui/Skeleton";
import type { FilterOptions } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import type { CourseFiltersParamsState } from "../courseFiltersParams";
import { areFiltersActive } from "../activeFilters";
import { useCourseFiltersData } from "../hooks/useCourseFiltersData";
import type { CourseFiltersData } from "../hooks/useCourseFiltersData";
import { CourseFiltersContent } from "./CourseFiltersContent";

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

function FieldSkeleton({ control }: Readonly<{ control: string }>) {
	return (
		<div className="space-y-2">
			<Skeleton className="h-4 w-24" />
			<Skeleton className={control} />
		</div>
	);
}

function SliderSkeleton() {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-4 w-10" />
			</div>
			<Skeleton className="my-2 h-1.5 w-full rounded-full" />
		</div>
	);
}

function CourseFiltersPanelSkeleton() {
	return (
		<div className="sticky top-22 space-y-6" aria-hidden="true">
			<div className="flex min-h-10 items-center">
				<Skeleton className="h-5 w-16" />
			</div>
			<div className="space-y-4">
				<div className="space-y-1.5">
					<FieldSkeleton control="h-9 w-full" />
					<Skeleton className="h-3 w-44" />
				</div>
				<FieldSkeleton control="h-11 w-full" />
			</div>
			<Separator />
			<div className="space-y-4">
				<FieldSkeleton control="h-9 w-full" />
				<FieldSkeleton control="h-9 w-full" />
				<SliderSkeleton />
			</div>
			<div className="space-y-4">
				<SliderSkeleton />
				<SliderSkeleton />
			</div>
			<Separator />
			<div className="space-y-4">
				<FieldSkeleton control="h-9 w-full" />
				<FieldSkeleton control="h-9 w-full" />
				<FieldSkeleton control="h-9 w-full" />
				<FieldSkeleton control="h-9 w-full" />
			</div>
		</div>
	);
}

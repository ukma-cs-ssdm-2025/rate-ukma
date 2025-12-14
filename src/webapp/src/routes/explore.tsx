import { useCallback, useEffect, useMemo, useState } from "react";

import { createFileRoute, Link } from "@tanstack/react-router";
import { Filter, MoreHorizontal } from "lucide-react";

import Layout from "@/components/Layout";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
	CourseFiltersDrawer,
	CourseFiltersPanel,
} from "@/features/courses/components/CourseFiltersPanel";
import { CoursesScatterPlot } from "@/features/courses/components/CoursesScatterPlot";
import {
	DEFAULT_COURSE_FILTERS_PARAMS,
	useCourseFiltersParams,
} from "@/features/courses/courseFiltersParams";
import {
	DIFFICULTY_RANGE,
	USEFULNESS_RANGE,
} from "@/features/courses/courseFormatting";
import type { CoursesListParams } from "@/lib/api/generated";
import { useCoursesFilterOptionsRetrieve } from "@/lib/api/generated";
import { withAuth } from "@/lib/auth";
import { localStorageAdapter } from "@/lib/storage";

const SHOW_ALL_LABELS_STORAGE_KEY = "explore:show-all-labels";

function ExploreRoute() {
	const [params, setParams] = useCourseFiltersParams();

	const filterOptionsQuery = useCoursesFilterOptionsRetrieve();
	const filterOptions = filterOptionsQuery.data;
	const isFilterOptionsLoading = filterOptionsQuery.isLoading;

	const apiFilters = useMemo<CoursesListParams>(
		() => ({
			name: params.q || undefined,
			avg_difficulty_min:
				params.diff[0] !== DIFFICULTY_RANGE[0] ? params.diff[0] : undefined,
			avg_difficulty_max:
				params.diff[1] !== DIFFICULTY_RANGE[1] ? params.diff[1] : undefined,
			avg_usefulness_min:
				params.use[0] !== USEFULNESS_RANGE[0] ? params.use[0] : undefined,
			avg_usefulness_max:
				params.use[1] !== USEFULNESS_RANGE[1] ? params.use[1] : undefined,
			faculty: params.faculty || undefined,
			department: params.dept || undefined,
			instructor: params.instructor || undefined,
			semester_term: params.term ?? undefined,
			semester_year: params.year || undefined,
			type_kind: params.type ?? undefined,
			speciality: params.spec || undefined,
		}),
		[params],
	);

	const [isFiltersOpen, setIsFiltersOpen] = useState(false);
	const [showAllLabels, setShowAllLabels] = useState<boolean>(() => {
		const stored = localStorageAdapter.getItem<boolean>(
			SHOW_ALL_LABELS_STORAGE_KEY,
		);
		return stored !== null ? stored : false;
	});

	useEffect(() => {
		localStorageAdapter.setItem(SHOW_ALL_LABELS_STORAGE_KEY, showAllLabels);
	}, [showAllLabels]);

	const handleResetFilters = useCallback(() => {
		setParams(DEFAULT_COURSE_FILTERS_PARAMS);
	}, [setParams]);

	const handleToggleShowAllLabels = (checked: boolean | "indeterminate") => {
		setShowAllLabels(checked === true);
	};

	return (
		<Layout>
			<div
				className="relative w-full"
				style={{ viewTransitionName: "scatter" }}
			>
				<div className="absolute right-6 top-4 z-10 flex gap-2">
					<Link
						to="/"
						search={(prev) => prev}
						className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground shadow-sm ring-offset-background transition-colors hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
					>
						← Назад до таблиці
					</Link>

					<Button
						variant="secondary"
						size="default"
						className="h-10 gap-2 shadow-sm lg:hidden"
						onClick={() => setIsFiltersOpen(true)}
					>
						<Filter className="h-4 w-4" />
						Фільтри
					</Button>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="secondary" size="default" className="h-10">
								<MoreHorizontal className="h-4 w-4" />
								<span className="sr-only">Налаштування</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuCheckboxItem
								checked={showAllLabels}
								onCheckedChange={handleToggleShowAllLabels}
							>
								Показати всі назви курсів
							</DropdownMenuCheckboxItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<div className="flex gap-6">
					<div className="hidden w-80 shrink-0 lg:block">
						<CourseFiltersPanel
							params={params}
							setParams={setParams}
							filterOptions={filterOptions}
							onReset={handleResetFilters}
							isLoading={isFilterOptionsLoading}
						/>
					</div>

					<div className="flex-1">
						<CoursesScatterPlot
							filters={apiFilters}
							forceShowAllLabels={showAllLabels}
						/>
					</div>
				</div>
			</div>

			<Drawer
				open={isFiltersOpen}
				onOpenChange={setIsFiltersOpen}
				ariaLabel="Фільтри курсів"
				closeButtonLabel="Закрити фільтри"
			>
				<CourseFiltersDrawer
					params={params}
					setParams={setParams}
					filterOptions={filterOptions}
					onReset={handleResetFilters}
					isLoading={isFilterOptionsLoading}
					onClose={() => setIsFiltersOpen(false)}
				/>
			</Drawer>
		</Layout>
	);
}

export const Route = createFileRoute("/explore")({
	component: withAuth(ExploreRoute),
});

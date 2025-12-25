import { useCallback, useEffect, useMemo, useState } from "react";

import { createFileRoute, Link } from "@tanstack/react-router";
import { Filter, MoreHorizontal } from "lucide-react";

import Layout from "@/components/Layout";
import { Button } from "@/components/ui/Button";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { Drawer } from "@/components/ui/Drawer";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { CourseFiltersDrawer } from "@/features/courses/components/CourseFiltersPanel";
import { CoursesScatterPlot } from "@/features/courses/components/CoursesScatterPlot";
import {
	courseFiltersStateToSearchParams,
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
	const searchParams = useMemo(
		() => courseFiltersStateToSearchParams(params),
		[params],
	);

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
		<Layout showFooter={false}>
			<div
				className="fixed inset-0 top-16 bg-background"
				style={{ viewTransitionName: "scatter" }}
			>
				<div className="relative h-full w-full">
					<div className="absolute left-1/2 top-4 z-20 -translate-x-1/2">
						<div className="flex items-center gap-2">
							<ButtonGroup
								aria-label="Перемикання режиму перегляду"
								className="rounded-lg border bg-card p-1 shadow-sm"
							>
								<Button asChild variant="ghost" size="sm">
									<Link to="/" search={() => searchParams}>
										Таблиця
									</Link>
								</Button>
								<Button asChild variant="secondary" size="sm">
									<Link to="/explore" search={() => searchParams}>
										Візуалізація
									</Link>
								</Button>
							</ButtonGroup>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-8 w-8 border bg-card p-0 shadow-sm"
										aria-label="Налаштування візуалізації"
									>
										<MoreHorizontal className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-56">
									<DropdownMenuCheckboxItem
										checked={showAllLabels}
										onCheckedChange={handleToggleShowAllLabels}
									>
										<div className="flex flex-col gap-0.5">
											<span className="font-medium text-foreground">
												Завжди показувати підписи
											</span>
											<span className="text-xs text-muted-foreground">
												Може перекривати точки, якщо їх багато
											</span>
										</div>
									</DropdownMenuCheckboxItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>

					<div className="absolute right-3 top-3 z-20">
						<Button
							variant="ghost"
							size="sm"
							className="gap-2 border bg-card/90 shadow-sm backdrop-blur"
							onClick={() => setIsFiltersOpen(true)}
							aria-label="Відкрити фільтри"
						>
							<Filter className="h-4 w-4" />
							<span className="hidden md:inline">Фільтри</span>
						</Button>
					</div>

					<div className="absolute inset-0">
						<CoursesScatterPlot
							filters={apiFilters}
							forceShowAllLabels={showAllLabels}
						/>
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
			</div>
		</Layout>
	);
}

export const Route = createFileRoute("/explore")({
	component: withAuth(ExploreRoute),
});

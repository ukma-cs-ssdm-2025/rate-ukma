import { useCallback, useEffect, useMemo, useState } from "react";

import { createFileRoute, Link } from "@tanstack/react-router";
import { Filter, Type } from "lucide-react";

import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { Drawer } from "@/components/ui/Drawer";
import { Toggle } from "@/components/ui/Toggle";
import { CourseFiltersDrawer } from "@/features/courses/components/CourseFiltersPanel";
import { CoursesScatterPlot } from "@/features/courses/components/CoursesScatterPlot";
import {
	courseFiltersStateToSearchParams,
	DEFAULT_COURSE_FILTERS_PARAMS,
	useCourseFiltersParams,
} from "@/features/courses/courseFiltersParams";
import { useCourseFiltersData } from "@/features/courses/hooks/useCourseFiltersData";
import {
	CREDITS_RANGE,
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

	const apiFilters = useMemo<CoursesListParams>(() => {
		return {
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
			semester_terms: params.term.length > 0 ? params.term : undefined,
			semester_year: params.year || undefined,
			credits_min:
				params.year && params.credits[0] !== CREDITS_RANGE[0]
					? params.credits[0]
					: undefined,
			credits_max:
				params.year && params.credits[1] !== CREDITS_RANGE[1]
					? params.credits[1]
					: undefined,
			type_kind: params.type ?? undefined,
			speciality: params.spec || undefined,
			education_level: params.eduLevel ?? undefined,
		};
	}, [params]);

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

	const { groups: filterGroups, hasActiveFilters } = useCourseFiltersData({
		params,
	});
	const activeFilterCount =
		filterGroups.rating.config.activeCount +
		filterGroups.semester.config.activeCount +
		filterGroups.structure.config.activeCount;

	const handleToggleShowAllLabels = (pressed: boolean) => {
		setShowAllLabels(pressed);
	};

	return (
		<Layout showFooter={false}>
			<div
				className="fixed inset-0 top-16 bg-background"
				style={{ viewTransitionName: "scatter" }}
			>
				<div className="relative h-full w-full">
					<div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
						<div className="pointer-events-auto flex h-9 items-center gap-2">
							<ButtonGroup
								aria-label="Перемикання режиму перегляду"
								className="h-9 bg-card/90 shadow-sm backdrop-blur"
							>
								<Button asChild variant="ghost" size="sm" className="h-full">
									<Link to="/" search={() => searchParams}>
										Таблиця
									</Link>
								</Button>
								<Button
									asChild
									variant="secondary"
									size="sm"
									className="h-full"
								>
									<Link to="/explore" search={() => searchParams}>
										Візуалізація
									</Link>
								</Button>
							</ButtonGroup>

							<Toggle
								variant="outline"
								pressed={showAllLabels}
								onPressedChange={handleToggleShowAllLabels}
								title="Може перекривати точки, якщо їх багато"
								aria-label="Завжди показувати підписи"
								className="h-9 bg-card/90 backdrop-blur"
							>
								<Type className="size-4" />
								<span className="hidden sm:inline">Підписи</span>
							</Toggle>

							<Button
								variant="outline"
								className="h-9 bg-card/90 backdrop-blur"
								onClick={() => setIsFiltersOpen(true)}
								aria-label={
									activeFilterCount > 0
										? `Відкрити фільтри (${activeFilterCount} активних)`
										: "Відкрити фільтри"
								}
							>
								<Filter className="size-4" />
								<span className="hidden sm:inline">Фільтри</span>
								{hasActiveFilters && activeFilterCount > 0 && (
									<Badge variant="soft" className="h-5 min-w-5 px-1.5">
										{activeFilterCount}
									</Badge>
								)}
							</Button>
						</div>
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

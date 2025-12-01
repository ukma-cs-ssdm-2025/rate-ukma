import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import {
	createFileRoute,
	Link,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { Filter, MoreHorizontal } from "lucide-react";
import { useForm } from "react-hook-form";

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
	DEFAULT_FILTERS,
	type FilterState,
	filterSchema,
} from "@/features/courses/filterSchema";
import { transformFiltersToApiParams } from "@/features/courses/filterTransformations";
import {
	filtersToSearchParams,
	searchParamsToFilters,
} from "@/features/courses/urlSync";
import type { CoursesListParams } from "@/lib/api/generated";
import { useCoursesFilterOptionsRetrieve } from "@/lib/api/generated";
import { withAuth } from "@/lib/auth";

type CoursesSearch = Record<string, string>;

function useFilterForm(initialFilters: FilterState) {
	const form = useForm<FilterState>({
		defaultValues: initialFilters,
		resolver: zodResolver(filterSchema),
		mode: "onChange",
	});

	useEffect(() => {
		form.reset(initialFilters);
	}, [form, initialFilters]);

	return form;
}

function ExploreRoute() {
	const navigate = useNavigate();
	const search = useSearch({ from: "/explore" });

	const initialFilters = useMemo(() => searchParamsToFilters(search), [search]);
	const form = useFilterForm(initialFilters);
	const filters = form.watch();
	const deferredFilters = useDeferredValue(filters);
	const searchParams = useMemo(
		() => filtersToSearchParams(deferredFilters),
		[deferredFilters],
	);

	const filterOptionsQuery = useCoursesFilterOptionsRetrieve();
	const filterOptions = filterOptionsQuery.data;
	const isFilterOptionsLoading = filterOptionsQuery.isLoading;

	const apiFilters = useMemo<CoursesListParams>(
		() => transformFiltersToApiParams(deferredFilters),
		[deferredFilters],
	);

	useEffect(() => {
		const timeout = setTimeout(() => {
			navigate({
				to: "/explore",
				search: searchParams,
				replace: true,
			});
		}, 400);

		return () => clearTimeout(timeout);
	}, [searchParams, navigate]);

	const [isFiltersOpen, setIsFiltersOpen] = useState(false);
	const [showAllLabels, setShowAllLabels] = useState(false);

	return (
		<Layout>
			<div className="fixed inset-0 top-16 bg-background">
				<div className="absolute inset-0 top-0 flex">
					<div className="relative flex-1">
						<div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
							<div className="flex items-center gap-2">
								<ButtonGroup
									aria-label="Перемикання режиму перегляду"
									className="rounded-lg border bg-card p-1 shadow-sm"
								>
									<Button asChild variant="ghost" size="sm">
										<Link to="/" search={searchParams}>
											Таблиця
										</Link>
									</Button>
									<Button asChild variant="secondary" size="sm">
										<Link to="/explore" search={searchParams}>
											Візуалізація
										</Link>
									</Button>
								</ButtonGroup>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											className="h-8 w-8 p-0 border shadow-sm"
											aria-label="Налаштування візуалізації"
										>
											<MoreHorizontal className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-56">
										<DropdownMenuCheckboxItem
											checked={showAllLabels}
											onCheckedChange={(checked) =>
												setShowAllLabels(Boolean(checked))
											}
										>
											<div className="flex flex-col gap-0.5">
												<span className="font-medium text-foreground">
													Показувати всі підписи
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

						{/* Filters Button (shared mobile/desktop trigger) */}
						<div className="absolute right-3 top-3 z-20">
							<Button
								variant="ghost"
								size="sm"
								className="gap-2 border bg-card/90 shadow-sm backdrop-blur"
								onClick={() => setIsFiltersOpen(true)}
							>
								<Filter className="h-4 w-4" />
								<span className="hidden md:inline">Фільтри</span>
							</Button>
						</div>

						{/* Main Chart Area */}
						<div className="absolute inset-0 top-0">
							<div className="w-full h-full px-0 py-4 md:py-6 lg:py-8">
								<CoursesScatterPlot
									filters={apiFilters}
									forceShowAllLabels={showAllLabels}
								/>
							</div>
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
						form={form}
						filterOptions={filterOptions}
						onReset={() => form.reset(DEFAULT_FILTERS)}
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
	validateSearch: (search: Record<string, unknown>): CoursesSearch => {
		const result: Record<string, string> = {};
		for (const [key, value] of Object.entries(search)) {
			if (typeof value === "string") {
				result[key] = value;
			}
		}
		return result;
	},
});

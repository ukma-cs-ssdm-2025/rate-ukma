import {
	type ComponentProps,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";

import { Link, useNavigate } from "@tanstack/react-router";
import {
	type ColumnDef,
	getCoreRowModel,
	getPaginationRowModel,
	type PaginationState,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, Filter, Maximize2, Search } from "lucide-react";

import { DataTable } from "@/components/DataTable/DataTable";
import { DataTableSkeleton } from "@/components/DataTable/DataTableSkeleton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import type { CourseList, CoursesListParams } from "@/lib/api/generated";
import {
	EducationLevelEnum,
	useCoursesFilterOptionsRetrieve,
	useStudentsMeCoursesRetrieve,
} from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { localStorageAdapter } from "@/lib/storage";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { ActiveFilterChips } from "./ActiveFilterChips";
import { CourseColumnHeader } from "./CourseColumnHeader";
import { CourseFiltersDrawer, CourseFiltersPanel } from "./CourseFiltersPanel";
import { CourseScoreCell } from "./CourseScoreCell";
import { CourseSpecialityBadges } from "./CourseSpecialityBadges";
import { CoursesScatterPlot } from "./CoursesScatterPlot";
import {
	CoursesReviewsSortMenu,
	type CoursesReviewsSortOption,
} from "./CoursesReviewsSortMenu";
import {
	type CourseFiltersParamsSetter,
	type CourseFiltersParamsState,
	courseFiltersStateToSearchParams,
	DEFAULT_COURSE_FILTERS_PARAMS,
} from "../courseFiltersParams";
import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "../courseFormatting";
import { transformFiltersToApiParams } from "../filterTransformations";
import { useCourseFiltersData } from "../hooks/useCourseFiltersData";

interface PaginationInfo {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
}

interface CoursesTableProps {
	data: CourseList[];
	isLoading: boolean;
	params: CourseFiltersParamsState;
	setParams: CourseFiltersParamsSetter;
	pagination?: PaginationInfo;
}

const MAP_COLLAPSED_STORAGE_KEY = "courses-map-collapsed";

function CoursesMapCard({
	filters,
	onOpenFullscreen,
}: Readonly<{
	filters: CoursesListParams;
	onOpenFullscreen: () => void;
}>) {
	const [collapsed, setCollapsed] = useState<boolean>(
		() =>
			localStorageAdapter.getItem<boolean>(MAP_COLLAPSED_STORAGE_KEY) ?? false,
	);
	const isDesktop = useMediaQuery("(min-width: 768px)");

	if (!isDesktop) {
		return (
			<section
				aria-label="Карта курсів"
				className="overflow-hidden rounded-xl border bg-card shadow-sm md:hidden"
			>
				<div className="flex items-center justify-between gap-2 px-4 pt-3">
					<h3 className="text-sm font-semibold">Карта курсів</h3>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 gap-2 text-muted-foreground"
						onClick={onOpenFullscreen}
						data-testid={testIds.courses.scatterPlotFullscreenButton}
					>
						<Maximize2 className="size-4" />
						Відкрити
					</Button>
				</div>
				<div className="relative mb-2 h-44">
					<div inert className="pointer-events-none absolute inset-0">
						<CoursesScatterPlot filters={filters} variant="mini" />
					</div>
				</div>
			</section>
		);
	}

	return (
		<Collapsible
			open={!collapsed}
			onOpenChange={(open) => {
				setCollapsed(!open);
				localStorageAdapter.setItem(MAP_COLLAPSED_STORAGE_KEY, !open);
			}}
			className="hidden overflow-hidden rounded-xl border bg-card shadow-sm md:block"
		>
			<div className="flex min-h-10 items-center justify-between gap-2 px-4 py-1">
				<h3 className="text-sm font-semibold">Карта курсів</h3>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						className="h-8 gap-2 text-muted-foreground"
						onClick={onOpenFullscreen}
						data-testid={testIds.courses.scatterPlotFullscreenButton}
					>
						<Maximize2 className="size-4" />
						Повний екран
					</Button>
					<CollapsibleTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0"
							aria-label={collapsed ? "Розгорнути карту" : "Згорнути карту"}
						>
							<ChevronDown
								className={cn(
									"size-4 transition-transform duration-200 motion-reduce:transition-none",
									!collapsed && "rotate-180",
								)}
							/>
						</Button>
					</CollapsibleTrigger>
				</div>
			</div>
			<CollapsibleContent>
				<div className="mb-2 h-64">
					<CoursesScatterPlot filters={filters} variant="mini" />
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

function buildCoursesTableColumns({
	reviewsSortValue,
	onReviewsSortChange,
	compact,
}: {
	reviewsSortValue: CoursesReviewsSortOption | null;
	onReviewsSortChange: (value: CoursesReviewsSortOption) => void;
	compact: boolean;
}): ColumnDef<CourseList>[] {
	return [
		{
			id: "title",
			accessorKey: "title",
			header: ({ column }) => (
				<CourseColumnHeader column={column} title="Назва курсу" />
			),
			cell: ({ row }) => {
				const course = row.original;
				const courseId = course.id;
				return (
					<span className="inline-flex flex-wrap items-center gap-1.5 whitespace-normal break-words">
						{courseId ? (
							<Link
								to="/courses/$courseId"
								params={{ courseId }}
								className="line-clamp-2 text-sm font-medium transition-colors motion-reduce:transition-none hover:text-primary hover:underline md:text-base"
								data-testid={testIds.courses.tableTitleLink}
							>
								{course.title}
							</Link>
						) : (
							<span className="line-clamp-2 text-sm font-medium md:text-base">
								{course.title}
							</span>
						)}
						{course.education_level === EducationLevelEnum.MASTER && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Badge
										variant="outline"
										className="shrink-0 cursor-default px-1.5"
									>
										М
									</Badge>
								</TooltipTrigger>
								<TooltipContent side="top">Магістр</TooltipContent>
							</Tooltip>
						)}
						<CourseSpecialityBadges specialities={course.specialities} />
					</span>
				);
			},
			enableSorting: false,
			size: compact ? 160 : 300,
			meta: {
				label: "Назва курсу",
				placeholder: "Пошук курсів...",
				variant: "text",
				align: "left",
			},
		},
		{
			id: "ratings_count",
			accessorKey: "ratings_count",
			header: () => (
				<div className="hidden text-muted-foreground sm:block">
					<CoursesReviewsSortMenu
						value={reviewsSortValue}
						onValueChange={onReviewsSortChange}
					/>
				</div>
			),
			cell: ({ row }) => {
				const count = row.getValue("ratings_count") as number;
				return (
					<div className="hidden sm:flex items-center justify-center">
						<span className="text-sm font-medium tabular-nums text-muted-foreground md:text-base">
							{count}
						</span>
					</div>
				);
			},
			enableSorting: false,
			meta: {
				label: "Відгуки",
				align: "center",
				// Low value on a narrow screen; the sort menu is desktop-only anyway.
				hideOnMobile: true,
			},
		},
		{
			id: "avg_difficulty",
			accessorKey: "avg_difficulty",
			header: ({ column }) => (
				<>
					<div className="flex justify-center md:hidden">
						<CourseColumnHeader
							column={column}
							title="Склад."
							initialSortDirection="asc"
							testId={testIds.courses.difficultySortButtonMobile}
							align="center"
							className="h-10 whitespace-nowrap text-xs [&_svg]:size-3.5"
						/>
					</div>
					<div className="hidden justify-center md:flex">
						<CourseColumnHeader
							column={column}
							title="Складність"
							initialSortDirection="asc"
							testId={testIds.courses.difficultySortButtonDesktop}
							align="center"
						/>
					</div>
				</>
			),
			cell: ({ row }) => (
				<CourseScoreCell
					value={row.getValue("avg_difficulty") as number}
					variant="difficulty"
				/>
			),
			enableSorting: true,
			size: compact ? 80 : 100,
			meta: {
				label: "Складність",
				placeholder: "Фільтр за складністю...",
				variant: "number",
				range: DIFFICULTY_RANGE,
				align: "center",
			},
		},
		{
			id: "avg_usefulness",
			accessorKey: "avg_usefulness",
			header: ({ column }) => (
				<>
					<div className="flex justify-center md:hidden">
						<CourseColumnHeader
							column={column}
							title="Корис."
							initialSortDirection="desc"
							testId={testIds.courses.usefulnessSortButtonMobile}
							align="center"
							className="h-10 whitespace-nowrap text-xs [&_svg]:size-3.5"
						/>
					</div>
					<div className="hidden justify-center md:flex">
						<CourseColumnHeader
							column={column}
							title="Корисність"
							initialSortDirection="desc"
							testId={testIds.courses.usefulnessSortButtonDesktop}
							align="center"
						/>
					</div>
				</>
			),
			cell: ({ row }) => (
				<CourseScoreCell
					value={row.getValue("avg_usefulness") as number}
					variant="usefulness"
				/>
			),
			enableSorting: true,
			size: compact ? 80 : 100,
			meta: {
				label: "Корисність",
				placeholder: "Фільтр за корисністю...",
				variant: "number",
				range: USEFULNESS_RANGE,
			},
		},
	];
}

function DebouncedInput({
	value: initialValue,
	onChange,
	debounce = 300,
	isLoading = false,
	...props
}: {
	value: string | number;
	onChange: (value: string | number) => void;
	debounce?: number;
	isLoading?: boolean;
} & Omit<ComponentProps<typeof Input>, "onChange">) {
	const [value, setValue] = useState(initialValue);

	useEffect(() => {
		setValue(initialValue);
	}, [initialValue]);

	useEffect(() => {
		const timeout = setTimeout(() => {
			if (value !== initialValue) {
				onChange(value);
			}
		}, debounce);

		return () => clearTimeout(timeout);
	}, [value, debounce, onChange, initialValue]);

	return (
		<div className="relative">
			<Input
				{...props}
				value={value}
				onChange={(e) => setValue(e.target.value)}
			/>
			{isLoading && (
				<Spinner className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
			)}
		</div>
	);
}

export function CoursesTable({
	data,
	isLoading,
	params,
	setParams,
	pagination: serverPagination,
}: Readonly<CoursesTableProps>) {
	const navigate = useNavigate({ from: "/" });
	const { isStudent } = useAuth();

	const sorting = useMemo<SortingState>(() => {
		const sortState: SortingState = [];

		if (params.diffOrder) {
			sortState.push({
				id: "avg_difficulty",
				desc: params.diffOrder === "desc",
			});
		}

		if (params.useOrder) {
			sortState.push({
				id: "avg_usefulness",
				desc: params.useOrder === "desc",
			});
		}

		return sortState;
	}, [params.diffOrder, params.useOrder]);

	const handleSortingChange = useCallback(
		(updater: SortingState | ((old: SortingState) => SortingState)) => {
			const newSorting =
				typeof updater === "function" ? updater(sorting) : updater;

			const diffSort = newSorting.find((s) => s.id === "avg_difficulty");
			const useSort = newSorting.find((s) => s.id === "avg_usefulness");

			let diffOrder: "asc" | "desc" | null = null;
			if (diffSort) {
				diffOrder = diffSort.desc ? "desc" : "asc";
			}

			let useOrder: "asc" | "desc" | null = null;
			if (useSort) {
				useOrder = useSort.desc ? "desc" : "asc";
			}

			setParams({
				diffOrder,
				useOrder,
				reviewSort: null,
				page: 1,
			});
		},
		[sorting, setParams],
	);

	const reviewsSortValue = useMemo<CoursesReviewsSortOption | null>(() => {
		if (params.diffOrder || params.useOrder) return null;
		return params.reviewSort ?? "by-count";
	}, [params.diffOrder, params.useOrder, params.reviewSort]);

	const handleReviewsSortChange = useCallback(
		(value: CoursesReviewsSortOption) => {
			setParams({
				reviewSort: value,
				diffOrder: null,
				useOrder: null,
				page: 1,
			});
		},
		[setParams],
	);

	const pagination = useMemo<PaginationState>(
		() => ({
			pageIndex: Math.max(0, params.page - 1),
			pageSize: params.size,
		}),
		[params.page, params.size],
	);

	const [isFiltersDrawerOpen, setIsFiltersDrawerOpen] = useState(false);
	// Compact score columns on phones so both fit at 390px without clipping.
	const isCompactTable = !useMediaQuery("(min-width: 640px)");

	const { data: studentCourses } = useStudentsMeCoursesRetrieve({
		query: {
			enabled: isStudent,
		},
	});

	const attendedCourseIds = useMemo(() => {
		if (!studentCourses) return new Set<string>();
		return new Set(
			studentCourses
				.map((course) => course.id)
				.filter((id): id is string => Boolean(id)),
		);
	}, [studentCourses]);

	const isRowHighlighted = useCallback(
		(course: CourseList) => {
			return course.id ? attendedCourseIds.has(course.id) : false;
		},
		[attendedCourseIds],
	);

	const handleRowClick = useCallback(
		(course: CourseList) => {
			if (!course.id) return;
			navigate({
				to: "/courses/$courseId",
				params: { courseId: course.id },
			});
		},
		[navigate],
	);

	const filterOptionsQuery = useCoursesFilterOptionsRetrieve();
	const filterOptions = filterOptionsQuery.data;
	const isFilterOptionsLoading = filterOptionsQuery.isLoading;

	const { groups: filterGroups } = useCourseFiltersData({
		params,
		filterOptions,
	});
	const activeFilterCount =
		filterGroups.rating.config.activeCount +
		filterGroups.semester.config.activeCount +
		filterGroups.structure.config.activeCount;

	const apiFilters = useMemo(
		() => transformFiltersToApiParams(params),
		[params],
	);

	const openExplore = useCallback(() => {
		navigate({
			to: "/explore",
			search: courseFiltersStateToSearchParams(params),
		});
	}, [navigate, params]);

	const columns = useMemo(
		() =>
			buildCoursesTableColumns({
				reviewsSortValue,
				onReviewsSortChange: handleReviewsSortChange,
				compact: isCompactTable,
			}),
		[reviewsSortValue, handleReviewsSortChange, isCompactTable],
	);

	const table = useReactTable({
		data,
		columns,
		manualSorting: true,
		manualPagination: true,
		onSortingChange: handleSortingChange,
		onPaginationChange: (updater) => {
			const newPagination =
				typeof updater === "function" ? updater(pagination) : updater;

			const nextSize = newPagination.pageSize;
			const nextPage = newPagination.pageIndex + 1;
			setParams({
				size: nextSize,
				page: nextSize !== params.size ? 1 : nextPage,
			});
		},
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		state: {
			sorting,
			pagination,
		},
		pageCount: serverPagination ? serverPagination.totalPages : -1,
	});

	const handleResetFilters = useCallback(() => {
		setParams(DEFAULT_COURSE_FILTERS_PARAMS);
	}, [setParams]);

	const hasActiveFilters = activeFilterCount > 0 || params.q !== "";

	const toggleFiltersDrawer = useCallback(() => {
		setIsFiltersDrawerOpen((prev) => !prev);
	}, []);

	const [hasResolvedFirstFetch, setHasResolvedFirstFetch] = useState(false);

	useEffect(() => {
		if (!isLoading) {
			setHasResolvedFirstFetch(true);
		}
	}, [isLoading]);

	const isInitialLoading = !hasResolvedFirstFetch && isLoading;
	const isPanelLoading = isInitialLoading || isFilterOptionsLoading;

	const renderTableContent = () => {
		if (isInitialLoading) {
			return <DataTableSkeleton columnCount={4} withViewOptions={false} />;
		}
		return (
			<DataTable
				table={table}
				totalRows={serverPagination?.total}
				serverPageCount={serverPagination?.totalPages}
				isRowHighlighted={isRowHighlighted}
				onRowClick={handleRowClick}
				emptyStateMessage={
					hasActiveFilters
						? "За цими фільтрами курсів немає"
						: "Курсів не знайдено за вашим запитом"
				}
				emptyStateTestId={testIds.courses.emptyState}
				emptyStateAction={
					hasActiveFilters ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-10 px-4"
							onClick={handleResetFilters}
						>
							Скинути фільтри
						</Button>
					) : undefined
				}
				data-testid={testIds.courses.table}
			/>
		);
	};

	return (
		<>
			{/* Room for the floating filters pill so it never covers the pagination. */}
			<div className="flex flex-col gap-6 pb-16 md:flex-row lg:pb-0">
				<div className="min-w-0 flex-1 space-y-4">
					<div className="relative min-h-10 flex-1">
						<Search className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
						<DebouncedInput
							placeholder="Пошук курсів за назвою..."
							value={params.q}
							onChange={(value) => {
								setParams({ q: String(value), page: 1 });
							}}
							className="h-10 pl-10 text-sm"
							disabled={isInitialLoading}
							isLoading={isLoading}
							data-testid={testIds.courses.searchInput}
						/>
					</div>

					{/* Phones only: the drawer covers the page while this row appears. */}
					<ActiveFilterChips
						params={params}
						setParams={setParams}
						filterOptions={filterOptions}
						className="lg:hidden"
					/>

					<CoursesMapCard filters={apiFilters} onOpenFullscreen={openExplore} />

					{renderTableContent()}
				</div>

				<div className="hidden w-80 shrink-0 lg:block">
					<CourseFiltersPanel
						params={params}
						setParams={setParams}
						filterOptions={filterOptions}
						onReset={handleResetFilters}
						isLoading={isPanelLoading}
					/>
				</div>
			</div>

			<div className="fixed inset-x-0 bottom-6 z-40 flex justify-center pb-[env(safe-area-inset-bottom)] lg:hidden">
				<Button
					type="button"
					className="h-10 gap-2 rounded-full px-5 shadow-lg"
					onClick={toggleFiltersDrawer}
					aria-label={
						activeFilterCount > 0
							? `Фільтри (${activeFilterCount} активних)`
							: "Фільтри"
					}
					data-testid={testIds.filters.drawerTrigger}
				>
					<Filter className="size-4" aria-hidden="true" />
					Фільтри
					{activeFilterCount > 0 && (
						<Badge className="border-transparent bg-primary-foreground text-primary">
							{activeFilterCount}
						</Badge>
					)}
				</Button>
			</div>

			<Drawer
				open={isFiltersDrawerOpen}
				side="bottom"
				onOpenChange={(open) => setIsFiltersDrawerOpen(open)}
				ariaLabel="Фільтри курсів"
				closeButtonLabel="Закрити фільтри"
			>
				<CourseFiltersDrawer
					params={params}
					setParams={setParams}
					filterOptions={filterOptions}
					onReset={handleResetFilters}
					isLoading={isPanelLoading}
					onClose={() => setIsFiltersDrawerOpen(false)}
				/>
			</Drawer>
		</>
	);
}

import {
	type ComponentProps,
	useCallback,
	useEffect,
	useMemo,
	useRef,
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
import {
	BookOpen,
	ChevronDown,
	Filter,
	Loader2,
	Maximize2,
} from "lucide-react";

import { DataTable } from "@/components/DataTable/DataTable";
import { DataTableSkeleton } from "@/components/DataTable/DataTableSkeleton";
import { Button } from "@/components/ui/Button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import type { CourseList, CoursesListParams } from "@/lib/api/generated";
import {
	useCoursesFilterOptionsRetrieve,
	useStudentsMeCoursesRetrieve,
} from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { localStorageAdapter } from "@/lib/storage";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { CourseColumnHeader } from "./CourseColumnHeader";
import { CourseFiltersDrawer, CourseFiltersPanel } from "./CourseFiltersPanel";
import { CourseScoreCell } from "./CourseScoreCell";
import { CourseSpecialityBadges } from "./CourseSpecialityBadges";
import { CoursesScatterPlot } from "./CoursesScatterPlot";
import {
	type CourseFiltersParamsSetter,
	type CourseFiltersParamsState,
	courseFiltersStateToSearchParams,
	DEFAULT_COURSE_FILTERS_PARAMS,
} from "../courseFiltersParams";
import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "../courseFormatting";
import {
	transformFiltersToApiParams,
	transformSortingToApiParams,
} from "../filterTransformations";

interface PaginationInfo {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
}

type ScatterPlotPreviewCardProps = Readonly<{
	filters: CoursesListParams;
	onOpenFullscreen?: () => void;
	heightClass: string;
	title?: string;
	subtitle?: string;
	showHeader?: boolean;
}>;

function ScatterPlotPreviewCard({
	filters,
	onOpenFullscreen,
	heightClass,
	title = "Карта курсів",
	subtitle = "Корисність та складність курсів",
	showHeader = true,
}: ScatterPlotPreviewCardProps) {
	const containerClass = cn(
		"relative w-full overflow-hidden",
		showHeader ? "rounded-lg border bg-card shadow-sm" : "bg-transparent",
		heightClass,
	);

	return (
		<div className={containerClass}>
			<div className="absolute inset-0">
				<CoursesScatterPlot filters={filters} variant="mini" />
			</div>

			{showHeader && (
				<div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-4 py-3 bg-gradient-to-b from-background/95 via-background/70 to-transparent">
					<div className="max-w-[70%] space-y-1">
						<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
							{title}
						</p>
						<p className="text-sm text-foreground/80">{subtitle}</p>
					</div>
					<Button
						size="sm"
						variant="secondary"
						className="gap-2 shadow-sm"
						onClick={onOpenFullscreen}
					>
						<Maximize2 className="h-4 w-4" />
						<span className="hidden sm:inline">Повний екран</span>
						<span className="sm:hidden">Відкрити</span>
					</Button>
				</div>
			)}
		</div>
	);
}

interface CoursesTableProps {
	data: CourseList[];
	isLoading: boolean;
	params: CourseFiltersParamsState;
	setParams: CourseFiltersParamsSetter;
	pagination?: PaginationInfo;
}

const SCATTER_COLLAPSE_STORAGE_KEY = "courses:scatter-open";
const FULLSCREEN_TRANSITION_DELAY_MS = 200;

const columns: ColumnDef<CourseList>[] = [
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
							className="font-semibold text-sm transition-colors hover:text-primary hover:underline md:text-base"
							data-testid={testIds.courses.tableTitleLink}
						>
							{course.title}
						</Link>
					) : (
						<span className="font-semibold text-sm md:text-base">
							{course.title}
						</span>
					)}
					<CourseSpecialityBadges specialities={course.course_specialities} />
				</span>
			);
		},
		enableSorting: false,
		size: 300,
		meta: {
			label: "Назва курсу",
			placeholder: "Пошук курсів...",
			variant: "text",
			icon: BookOpen,
			align: "left",
		},
	},
	{
		id: "ratings_count",
		accessorKey: "ratings_count",
		header: ({ column }) => (
			<div className="hidden sm:block">
				<CourseColumnHeader column={column} title="Відгуки" />
			</div>
		),
		cell: ({ row }) => {
			const count = row.getValue("ratings_count") as number;
			return (
				<div className="hidden sm:flex items-center justify-center">
					<span className="text-sm font-medium text-muted-foreground md:text-base">
						{count}
					</span>
				</div>
			);
		},
		enableSorting: false,
		size: 80,
		meta: {
			label: "Відгуки",
			align: "center",
		},
	},
	{
		id: "avg_difficulty",
		accessorKey: "avg_difficulty",
		header: ({ column }) => (
			<>
				<div className="md:hidden">
					<CourseColumnHeader column={column} title="Склад." />
				</div>
				<div className="hidden md:block">
					<CourseColumnHeader column={column} title="Складність" />
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
		size: 100,
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
				<div className="md:hidden">
					<CourseColumnHeader column={column} title="Корисн." />
				</div>
				<div className="hidden md:block">
					<CourseColumnHeader column={column} title="Корисність" />
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
		size: 100,
		meta: {
			label: "Корисність",
			placeholder: "Фільтр за корисністю...",
			variant: "number",
			range: USEFULNESS_RANGE,
			align: "center",
		},
	},
];

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
				<div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin" />
				</div>
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

	const [sorting, setSorting] = useState<SortingState>([]);

	const pagination = useMemo<PaginationState>(
		() => ({
			pageIndex: params.page - 1,
			pageSize: params.size,
		}),
		[params.page, params.size],
	);

	const [isFiltersDrawerOpen, setIsFiltersDrawerOpen] = useState(false);
	const isDesktop = useMediaQuery("(min-width: 768px)");
	const [isScatterPlotOpen, setIsScatterPlotOpen] = useState<boolean>(() => {
		const stored = localStorageAdapter.getItem<boolean>(
			SCATTER_COLLAPSE_STORAGE_KEY,
		);
		return stored ?? true;
	});
	const hasInitializedRef = useRef(false);
	const fullscreenTimeoutRef = useRef<number | null>(null);

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

	const clearFullscreenTimeout = useCallback(() => {
		const timeoutId = fullscreenTimeoutRef.current;
		if (timeoutId === null) return;

		clearTimeout(timeoutId);
		fullscreenTimeoutRef.current = null;
	}, []);

	const filterOptionsQuery = useCoursesFilterOptionsRetrieve();
	const filterOptions = filterOptionsQuery.data;
	const isFilterOptionsLoading = filterOptionsQuery.isLoading;

	useEffect(() => {
		localStorageAdapter.setItem(
			SCATTER_COLLAPSE_STORAGE_KEY,
			isScatterPlotOpen,
		);
	}, [isScatterPlotOpen]);

	useEffect(() => {
		if (hasInitializedRef.current) return;
		hasInitializedRef.current = true;

		if (!isDesktop) setIsScatterPlotOpen(true);
	}, [isDesktop]);

	const openExploreWithAnimation = useCallback(() => {
		const runNavigation = () =>
			navigate({
				to: "/explore",
				search: courseFiltersStateToSearchParams(params),
			});

		setIsScatterPlotOpen(true);

		if ("startViewTransition" in document) {
			document.startViewTransition(runNavigation);
			return;
		}

		clearFullscreenTimeout();

		fullscreenTimeoutRef.current = globalThis.window.setTimeout(
			runNavigation,
			FULLSCREEN_TRANSITION_DELAY_MS,
		);
	}, [clearFullscreenTimeout, navigate, params]);

	useEffect(
		() => () => {
			clearFullscreenTimeout();
		},
		[clearFullscreenTimeout],
	);

	const apiSorting = useMemo(() => {
		if (sorting.length === 0) return {};
		const firstSort = sorting[0];
		return transformSortingToApiParams(firstSort.id, firstSort.desc);
	}, [sorting]);

	const apiFilters = useMemo(
		() => transformFiltersToApiParams(params),
		[params],
	);

	const combinedFilters = useMemo(
		() => ({ ...apiSorting, ...apiFilters }),
		[apiSorting, apiFilters],
	);

	const table = useReactTable({
		data,
		columns,
		manualSorting: true,
		manualPagination: true,
		onSortingChange: setSorting,
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
				emptyStateMessage="Курсів не знайдено за вашим запитом"
				data-testid={testIds.courses.table}
			/>
		);
	};

	return (
		<>
			<div className="flex flex-col gap-6 md:flex-row">
				<div className="flex-1 min-w-0 space-y-4">
					<div className="flex items-center gap-4">
						<div className="relative flex-1">
							<BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 z-10 text-muted-foreground" />
							<DebouncedInput
								placeholder="Пошук курсів за назвою..."
								value={params.q}
								onChange={(value) => {
									setParams({ q: String(value), page: 1 });
								}}
								className="pl-10 h-12 text-base"
								disabled={isInitialLoading}
								isLoading={isLoading}
								data-testid={testIds.courses.searchInput}
							/>
						</div>
					</div>

					{isDesktop ? (
						<Collapsible
							open={isScatterPlotOpen}
							onOpenChange={setIsScatterPlotOpen}
							className="border rounded-lg overflow-hidden bg-card shadow-sm"
						>
							<div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
								<h3 className="font-medium text-sm">Карта курсів</h3>
								<div className="flex items-center gap-2">
									<Button
										variant="ghost"
										size="sm"
										className="h-8 gap-2 text-muted-foreground hover:text-foreground"
										onClick={openExploreWithAnimation}
										data-testid={testIds.courses.scatterPlotFullscreenButton}
									>
										<Maximize2 className="h-4 w-4" />
										<span className="hidden sm:inline">Повний екран</span>
									</Button>
									<CollapsibleTrigger asChild>
										<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
											<ChevronDown
												className={`h-4 w-4 transition-transform duration-200 ${
													isScatterPlotOpen ? "rotate-180" : ""
												}`}
											/>
											<span className="sr-only">Toggle</span>
										</Button>
									</CollapsibleTrigger>
								</div>
							</div>
							<CollapsibleContent>
								<ScatterPlotPreviewCard
									filters={combinedFilters}
									showHeader={false}
									heightClass="h-[350px]"
								/>
							</CollapsibleContent>
						</Collapsible>
					) : (
						<ScatterPlotPreviewCard
							filters={combinedFilters}
							onOpenFullscreen={openExploreWithAnimation}
							heightClass="h-[260px]"
							title="Карта курсів"
							subtitle="Торкніться, щоб розкрити на весь екран"
						/>
					)}

					{renderTableContent()}
				</div>

				<div className="hidden lg:block w-80 shrink-0">
					<CourseFiltersPanel
						params={params}
						setParams={setParams}
						filterOptions={filterOptions}
						onReset={handleResetFilters}
						isLoading={isPanelLoading}
					/>
				</div>
			</div>

			<button
				type="button"
				className="fixed right-0 z-40 grid h-10 w-10 items-center justify-center rounded-l-2xl border border-border bg-background shadow-lg shadow-black/20 transition hover:bg-accent hover:text-accent-foreground lg:hidden"
				style={{ top: "35%" }}
				onClick={toggleFiltersDrawer}
				aria-label="Фільтри"
				data-testid={testIds.filters.drawerTrigger}
			>
				<Filter className="h-6 w-6" />
			</button>

			<Drawer
				open={isFiltersDrawerOpen}
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

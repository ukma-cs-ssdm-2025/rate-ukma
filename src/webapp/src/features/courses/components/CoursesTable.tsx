import {
	type ComponentProps,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
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
import { useForm } from "react-hook-form";

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
import { useCoursesFilterOptionsRetrieve } from "@/lib/api/generated";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { localStorageAdapter } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { CourseColumnHeader } from "./CourseColumnHeader";
import { CourseFiltersDrawer, CourseFiltersPanel } from "./CourseFiltersPanel";
import { CourseScoreCell } from "./CourseScoreCell";
import { CourseSpecialityBadges } from "./CourseSpecialityBadges";
import { CoursesEmptyState } from "./CoursesEmptyState";
import { CoursesScatterPlot } from "./CoursesScatterPlot";
import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "../courseFormatting";
import {
	DEFAULT_FILTERS,
	type FilterState,
	filterSchema,
} from "../filterSchema";
import {
	transformFiltersToApiParams,
	transformSortingToApiParams,
} from "../filterTransformations";
import { filtersToSearchParams } from "../urlSync";

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
	onRowClick?: (course: CourseList) => void;
	onFiltersChange?: (filters: Record<string, unknown>) => void;
	filtersKey: string;
	pagination?: PaginationInfo;
	initialFilters?: FilterState;
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
			return (
				<span className="whitespace-normal break-words">
					<span className="font-semibold text-sm transition-colors group-hover:text-primary group-hover:underline md:text-base">
						{course.title}
					</span>{" "}
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
	onRowClick,
	onFiltersChange,
	filtersKey,
	pagination: serverPagination,
	initialFilters = DEFAULT_FILTERS,
}: Readonly<CoursesTableProps>) {
	const navigate = useNavigate({ from: "/" });

	const [sorting, setSorting] = useState<SortingState>([]);
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: serverPagination ? serverPagination.page - 1 : 0,
		pageSize: serverPagination ? serverPagination.pageSize : 20,
	});

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

	const clearFullscreenTimeout = useCallback(() => {
		const timeoutId = fullscreenTimeoutRef.current;
		if (timeoutId === null) return;

		clearTimeout(timeoutId);
		fullscreenTimeoutRef.current = null;
	}, []);

	const form = useForm({
		defaultValues: initialFilters,
		resolver: zodResolver(filterSchema),
		mode: "onChange",
	});

	const filters = form.watch();
	const deferredFilters = useDeferredValue(filters);

	const filterOptionsQuery = useCoursesFilterOptionsRetrieve();
	const filterOptions = filterOptionsQuery.data;
	const isFilterOptionsLoading = filterOptionsQuery.isLoading;

	useEffect(() => {
		form.reset(initialFilters);
	}, [form, initialFilters]);

	useEffect(() => {
		localStorageAdapter.setItem(
			SCATTER_COLLAPSE_STORAGE_KEY,
			isScatterPlotOpen,
		);
	}, [isScatterPlotOpen]);

	// Only initialize scatter plot state once on mount, don't reset on viewport changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only run once on mount
	useEffect(() => {
		if (hasInitializedRef.current) return;
		hasInitializedRef.current = true;

		if (!isDesktop) {
			setIsScatterPlotOpen(true);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const openExploreWithAnimation = useCallback(() => {
		const runNavigation = () =>
			navigate({
				to: "/explore",
				search: filtersToSearchParams(deferredFilters),
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
	}, [clearFullscreenTimeout, deferredFilters, navigate]);

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
		() => transformFiltersToApiParams(deferredFilters),
		[deferredFilters],
	);

	const combinedFilters = useMemo(
		() => ({ ...apiSorting, ...apiFilters }),
		[apiSorting, apiFilters],
	);

	useEffect(() => {
		if (serverPagination) {
			setPagination({
				pageIndex: serverPagination.page - 1,
				pageSize: serverPagination.pageSize,
			});
		}
	}, [serverPagination]);

	const table = useReactTable({
		data,
		columns,
		manualSorting: true,
		manualPagination: true,
		onSortingChange: setSorting,
		onPaginationChange: (updater) => {
			const newPagination =
				typeof updater === "function" ? updater(pagination) : updater;

			setPagination(newPagination);

			if (onFiltersChange) {
				onFiltersChange({
					...combinedFilters,
					page: newPagination.pageIndex + 1,
					page_size: newPagination.pageSize,
				});
			}
		},
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		state: {
			sorting,
			pagination,
		},
		pageCount: serverPagination ? serverPagination.totalPages : -1,
	});

	useEffect(() => {
		if (filtersKey === undefined) {
			return;
		}

		setPagination((previous) =>
			previous.pageIndex === 0 ? previous : { ...previous, pageIndex: 0 },
		);
	}, [filtersKey]);

	const previousFiltersRef = useRef<Record<string, unknown>>({});
	const urlSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		if (urlSyncTimeoutRef.current) {
			clearTimeout(urlSyncTimeoutRef.current);
		}

		urlSyncTimeoutRef.current = setTimeout(() => {
			const searchParams = filtersToSearchParams(deferredFilters);
			navigate({
				search: searchParams,
				replace: true,
			});
		}, 500);

		return () => {
			if (urlSyncTimeoutRef.current) {
				clearTimeout(urlSyncTimeoutRef.current);
			}
		};
	}, [deferredFilters, navigate]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: pagination is intentionally excluded to prevent circular updates
	useEffect(() => {
		const hasFiltersChanged =
			JSON.stringify(combinedFilters) !==
			JSON.stringify(previousFiltersRef.current);

		if (hasFiltersChanged) {
			if (pagination.pageIndex !== 0) {
				setPagination((prev) => ({ ...prev, pageIndex: 0 }));
			}

			const timeout = setTimeout(() => {
				previousFiltersRef.current = combinedFilters;

				const filtersWithPagination = {
					...combinedFilters,
					page: 1,
					page_size: pagination.pageSize,
				};

				onFiltersChange?.(filtersWithPagination);
			}, 500);

			return () => clearTimeout(timeout);
		}

		return undefined;
	}, [combinedFilters, onFiltersChange]);

	const handleResetFilters = useCallback(() => {
		form.reset(DEFAULT_FILTERS);
	}, [form]);

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
	const isEmptyState = !isLoading && data.length === 0;

	const renderTableContent = () => {
		if (isInitialLoading) {
			return <DataTableSkeleton columnCount={4} withViewOptions={false} />;
		}
		if (isEmptyState) {
			return <CoursesEmptyState />;
		}
		return (
			<DataTable
				table={table}
				onRowClick={onRowClick}
				totalRows={serverPagination?.total}
				serverPageCount={serverPagination?.totalPages}
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
								value={filters.searchQuery as string}
								onChange={(value) =>
									form.setValue("searchQuery", value as string, {
										shouldDirty: true,
									})
								}
								className="pl-10 h-12 text-base"
								disabled={isInitialLoading}
								isLoading={isLoading}
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
						form={form}
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
					form={form}
					filterOptions={filterOptions}
					onReset={handleResetFilters}
					isLoading={isPanelLoading}
					onClose={() => setIsFiltersDrawerOpen(false)}
				/>
			</Drawer>
		</>
	);
}

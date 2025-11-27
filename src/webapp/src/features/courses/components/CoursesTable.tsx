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
import { BookOpen, Filter, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { DataTable } from "@/components/DataTable/DataTable";
import { DataTableSkeleton } from "@/components/DataTable/DataTableSkeleton";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import type { CourseList } from "@/lib/api/generated";
import { useCoursesFilterOptionsRetrieve } from "@/lib/api/generated";
import { CourseColumnHeader } from "./CourseColumnHeader";
import { CourseFiltersDrawer, CourseFiltersPanel } from "./CourseFiltersPanel";
import { CourseScoreCell } from "./CourseScoreCell";
import { CourseSpecialityBadges } from "./CourseSpecialityBadges";
import { CoursesEmptyState } from "./CoursesEmptyState";
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

interface CoursesTableProps {
	data: CourseList[];
	isLoading: boolean;
	onRowClick?: (course: CourseList) => void;
	onFiltersChange?: (filters: Record<string, unknown>) => void;
	filtersKey: string;
	pagination?: PaginationInfo;
	initialFilters?: FilterState;
}

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

		if (!hasFiltersChanged) {
			return;
		}

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

import { useState } from "react";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";
import type {
	SyncPendingResponse,
	SyncPreviewRequest,
	SyncSummary,
} from "@/lib/api/generated";
import {
	ukmaDataSyncPendingList,
	useUkmaDataSyncSummary,
} from "@/lib/api/generated";
import { fieldLabel, readPath } from "../sync";
import { formatCount } from "../syncFormat";
import { fieldValueWord, LIST_PAGE_SIZE } from "../syncLabels";
import { NO_RETRY } from "../syncOverview";
import { PREVIEW_ROWS_QUERY_KEY } from "../syncQueries";
import { entryIds, nestLinks, visibleFields } from "../syncReviewList";
import { STEP_COPY } from "../syncSteps";
import type { ReviewStep } from "../syncSteps";
import { DataSegments } from "./DataBits";
import { SyncApplyBar } from "./SyncApplyBar";
import { SyncListFilters } from "./SyncListFilters";
import {
	SyncReviewHeader,
	SyncReviewRow,
	SyncReviewSkeleton,
} from "./SyncReviewRows";
import { UkmaDataError } from "./UkmaDataError";

const ALL_FIELDS = "all";
const MORE_FIELDS = "more";
const ALL_ROWS = "all";
const RATED_ROWS = "rated";
const SEARCH_DEBOUNCE_MS = 300;
const YEAR_STEPS: ReadonlySet<ReviewStep> = new Set(["new"]);

interface RowFilters {
	field: string | null;
	onlyRated: boolean;
	q: string | null;
	year: number | null;
}

function topPairs(summary: SyncSummary | undefined, field: string): string[] {
	const step = summary?.steps.find((item) => item.step === "field_changes");
	const pairs = readPath(step?.facets, "fields", field, "top_pairs");
	if (!Array.isArray(pairs)) {
		return [];
	}
	return pairs.flatMap((pair) => {
		const before = readPath(pair, "before");
		const after = readPath(pair, "after");
		const count = readPath(pair, "count");
		if (
			typeof before !== "string" ||
			typeof after !== "string" ||
			typeof count !== "number"
		) {
			return [];
		}
		return [
			`${fieldValueWord(field, before)} → ${fieldValueWord(field, after)}: ${formatCount(count)}`,
		];
	});
}

function FieldFilter({
	page,
	field,
	onChange,
}: Readonly<{
	page: SyncPendingResponse;
	field: string | null;
	onChange: (field: string | null) => void;
}>) {
	const [expanded, setExpanded] = useState(false);
	const summary = useUkmaDataSyncSummary({ source: "catalog" }, NO_RETRY);
	const all = Object.keys(page.changed_fields).length;
	if (all < 2) {
		return null;
	}
	const shown = visibleFields(page.changed_fields, field, expanded);
	const hidden = all - shown.length;
	const pairs = field === null ? [] : topPairs(summary.data, field);
	return (
		<div className="space-y-2">
			<DataSegments
				label="Яке поле змінюється"
				value={field ?? ALL_FIELDS}
				onChange={(value) => {
					if (value === MORE_FIELDS) {
						setExpanded(true);
						return;
					}
					onChange(value === ALL_FIELDS ? null : value);
				}}
				items={[
					{ value: ALL_FIELDS, label: "Усі поля" },
					...shown.map(([name, count]) => ({
						value: name,
						label: fieldLabel(name),
						count,
					})),
					...(hidden > 0
						? [{ value: MORE_FIELDS, label: `Ще ${formatCount(hidden)}` }]
						: []),
				]}
			/>
			{pairs.length > 0 ? (
				<p className="text-sm text-muted-foreground">
					Найчастіше: {pairs.join("; ")}.
				</p>
			) : null}
		</div>
	);
}

function RatedFilter({
	rated,
	onChange,
}: Readonly<{ rated: boolean; onChange: (rated: boolean) => void }>) {
	return (
		<DataSegments
			label="Які записи"
			value={rated ? RATED_ROWS : ALL_ROWS}
			onChange={(value) => onChange(value === RATED_ROWS)}
			items={[
				{ value: ALL_ROWS, label: "Усі" },
				{ value: RATED_ROWS, label: "З оцінками" },
			]}
		/>
	);
}

function usePendingRows(step: ReviewStep, filters: RowFilters) {
	const { group, rated, match } = STEP_COPY[step].slice;
	const { field, onlyRated, q, year } = filters;
	return useInfiniteQuery({
		queryKey: [PREVIEW_ROWS_QUERY_KEY, step, field, onlyRated, q, year],
		queryFn: ({ pageParam, signal }) =>
			ukmaDataSyncPendingList(
				{
					source: "catalog",
					group: group === "other" ? undefined : group,
					rated: onlyRated ? true : (rated ?? undefined),
					match: match ?? undefined,
					changed_field: field ?? undefined,
					q: q ?? undefined,
					year_from: year ?? undefined,
					year_to: year ?? undefined,
					page: pageParam,
					page_size: LIST_PAGE_SIZE,
				},
				signal,
			),
		initialPageParam: 1,
		getNextPageParam: (last) => last.next_page,
		placeholderData: keepPreviousData,
		retry: false,
		staleTime: 0,
	});
}

function useSelection(preselect: boolean) {
	const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
	const isIncluded = (id: number) => picked.has(id) !== preselect;
	const toggle = (ids: readonly number[], included: boolean) =>
		setPicked((current) => {
			const next = new Set(current);
			for (const id of ids) {
				if (included === preselect) {
					next.delete(id);
				} else {
					next.add(id);
				}
			}
			return next;
		});
	return { picked, isIncluded, toggle, reset: () => setPicked(new Set()) };
}

export function SyncChangeList({
	step,
	field,
	onField,
}: Readonly<{
	step: ReviewStep;
	field: string | null;
	onField: (field: string | null) => void;
}>) {
	const copy = STEP_COPY[step];
	const [onlyRated, setOnlyRated] = useState(false);
	const [query, setQuery] = useState("");
	const [year, setYear] = useState<number | null>(null);
	const searched = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
	const q = searched === "" ? null : searched;
	const rows = usePendingRows(step, { field, onlyRated, q, year });
	const selection = useSelection(copy.preselect);
	const pages = rows.data?.pages ?? [];
	const first = pages[0];
	const items = pages.flatMap((page) => page.items);
	const entries = copy.slice.group === "link" ? nestLinks(items) : [];
	const listed =
		entries.length > 0
			? entries
			: items.map((change) => ({ change, nested: [] }));
	const semester = listed.some(({ change }) => change.view.semester !== null);
	const total = first?.total ?? 0;
	if (rows.isLoading) {
		return <SyncReviewSkeleton />;
	}
	if (rows.error || first === undefined) {
		return (
			<UkmaDataError
				error={rows.error}
				title="Не вдалося завантажити зміни"
				onRetry={() => void rows.refetch()}
				isRetrying={rows.isRefetching}
			/>
		);
	}
	const picked = items.flatMap((change) =>
		selection.picked.has(change.id) ? [change.id] : [],
	);
	const run = first.runs[0]?.id ?? null;
	const request: SyncPreviewRequest = copy.preselect
		? {
				source: "catalog",
				group: copy.slice.group,
				rated: onlyRated ? true : copy.slice.rated,
				match: copy.slice.match,
				changed_field: field,
				q,
				year_from: year,
				year_to: year,
				run,
				exclude_ids: picked,
			}
		: { source: "catalog", run, change_ids: picked };
	const selected = copy.preselect
		? Math.max(0, total - picked.length)
		: picked.length;
	const lock = rows.isPlaceholderData;
	return (
		<div className="space-y-4">
			<SyncListFilters
				query={query}
				onQuery={(next) => {
					selection.reset();
					setQuery(next);
				}}
				year={year}
				onYear={
					YEAR_STEPS.has(step)
						? (next) => {
								selection.reset();
								setYear(next);
							}
						: null
				}
			/>
			<FieldFilter
				page={first}
				field={field}
				onChange={(next) => {
					selection.reset();
					onField(next);
				}}
			/>
			{step === "new" ? (
				<RatedFilter
					rated={onlyRated}
					onChange={(next) => {
						selection.reset();
						setOnlyRated(next);
					}}
				/>
			) : null}
			{copy.preselect || items.length === 0 ? null : (
				<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
					<p>Тут нічого не вибрано наперед: позначте те, що перевірили.</p>
					<Button
						variant="ghost"
						size="sm"
						disabled={lock}
						onClick={() =>
							selection.toggle(
								items.map((change) => change.id),
								true,
							)
						}
					>
						Вибрати показані
					</Button>
				</div>
			)}
			{items.length === 0 ? (
				<p className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground sm:px-5">
					Тут уже нічого не чекає.
				</p>
			) : (
				<div
					aria-busy={lock}
					className={cn(
						"overflow-hidden rounded-xl border bg-card transition-opacity duration-200",
						lock && "opacity-60",
					)}
				>
					<SyncReviewHeader
						selectable={copy.decidable}
						column={copy.column}
						semester={semester}
					/>
					<ul aria-label={copy.title} className="divide-y">
						{listed.map((entry) => (
							<SyncReviewRow
								key={entry.change.id}
								change={entry.change}
								nested={entry.nested}
								semester={semester}
								selectable={copy.decidable}
								included={selection.isIncluded(entry.change.id)}
								locked={lock}
								onToggle={(_, included) => {
									if (!lock) {
										selection.toggle(entryIds(entry), included);
									}
								}}
							/>
						))}
					</ul>
				</div>
			)}
			<div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
				<span className="tabular-nums">
					Показано {formatCount(items.length)} з {formatCount(total)}
				</span>
				{rows.hasNextPage ? (
					<Button
						variant="outline"
						size="sm"
						onClick={() => void rows.fetchNextPage()}
						disabled={rows.isFetchingNextPage}
					>
						{rows.isFetchingNextPage ? <Spinner /> : null}
						Показати ще
					</Button>
				) : null}
			</div>
			{copy.decidable && total > 0 ? (
				<SyncApplyBar
					selection={request}
					runId={run}
					selected={selected}
					total={total}
					disabled={lock}
					onDecided={selection.reset}
				/>
			) : null}
		</div>
	);
}

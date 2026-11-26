import { useState } from "react";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useQueryState } from "nuqs";

import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import type { SyncPreviewRequest } from "@/lib/api/generated";
import { ukmaDataSyncPendingList } from "@/lib/api/generated";
import { formatCount } from "../syncFormat";
import { LIST_PAGE_SIZE } from "../syncLabels";
import { reviewFieldParser, reviewStepParser } from "../syncPreviewParams";
import { PREVIEW_ROWS_QUERY_KEY } from "../syncQueries";
import { STEP_COPY } from "../syncSteps";
import type { ReviewStep } from "../syncSteps";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import type { ListFilter } from "../syncListFilters";
import { SyncApplyBar } from "./SyncApplyBar";
import { FieldFilter, SearchFilter } from "./SyncListFilters";
import { SyncQuestionList } from "./SyncQuestionList";
import {
	SyncReviewHeader,
	SyncReviewRow,
	SyncReviewSkeleton,
} from "./SyncReviewRows";
import { UkmaDataError } from "./UkmaDataError";

const SEARCH_DEBOUNCE_MS = 300;

function usePendingRows(step: ReviewStep, filter: ListFilter) {
	const { group, rated, match, quiet } = STEP_COPY[step].slice;
	const { field, query, year } = filter;
	return useInfiniteQuery({
		queryKey: [PREVIEW_ROWS_QUERY_KEY, step, field, query, year],
		queryFn: ({ pageParam, signal }) =>
			ukmaDataSyncPendingList(
				{
					source: "catalog",
					group: group === "other" ? undefined : group,
					rated: rated ?? undefined,
					match: match ?? undefined,
					quiet: quiet ?? undefined,
					changed_field: field ?? undefined,
					q: query || undefined,
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

function ChangeList({
	step,
	field,
	onField,
}: Readonly<{
	step: ReviewStep;
	field: string | null;
	onField: (field: string | null) => void;
}>) {
	const copy = STEP_COPY[step];
	const [draft, setDraft] = useState("");
	const [year, setYear] = useState<number | null>(null);
	const query = useDebouncedValue(draft.trim(), SEARCH_DEBOUNCE_MS);
	const filter = { field, query, year };
	const rows = usePendingRows(step, filter);
	const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());
	const [filtered, setFiltered] = useState(filter);
	if (
		filtered.field !== field ||
		filtered.query !== query ||
		filtered.year !== year
	) {
		setFiltered(filter);
		setExcluded(new Set());
	}
	const pages = rows.data?.pages ?? [];
	const first = pages[0];
	const items = pages.flatMap((page) => page.items);
	const total = first?.total ?? 0;
	const left = items.flatMap((change) =>
		excluded.has(change.id) ? [change.id] : [],
	);
	const toggle = (id: number, included: boolean) => {
		if (rows.isPlaceholderData) {
			return;
		}
		setExcluded((current) => {
			const next = new Set(current);
			if (included) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};
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
	const selection: SyncPreviewRequest = {
		source: "catalog",
		group: copy.slice.group,
		rated: copy.slice.rated,
		match: copy.slice.match,
		quiet: copy.slice.quiet,
		changed_field: field,
		q: query || null,
		year_from: year,
		year_to: year,
		run: first.runs[0]?.id ?? null,
		exclude_ids: left,
	};
	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
				<SearchFilter
					query={draft}
					onQuery={setDraft}
					year={year}
					onYear={copy.slice.group === "new" ? setYear : null}
				/>
				<FieldFilter page={first} field={field} onChange={onField} />
			</div>
			{items.length === 0 ? (
				<p className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground sm:px-5">
					{query || year !== null
						? "Нічого не знайдено. Змініть пошук або рік."
						: "Тут уже нічого не чекає."}
				</p>
			) : (
				<div
					aria-busy={rows.isPlaceholderData}
					className={cn(
						"overflow-hidden rounded-xl border bg-card transition-opacity duration-200",
						rows.isPlaceholderData && "opacity-60",
					)}
				>
					<SyncReviewHeader selectable={copy.decidable} column={copy.column} />
					<ul aria-label={copy.title} className="divide-y">
						{items.map((change) => (
							<SyncReviewRow
								key={change.id}
								change={change}
								selectable={copy.decidable}
								included={!excluded.has(change.id)}
								locked={rows.isPlaceholderData}
								onToggle={toggle}
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
					selection={selection}
					runId={first.runs[0]?.id ?? null}
					selected={Math.max(0, total - left.length)}
					total={total}
					disabled={rows.isPlaceholderData}
					onDecided={() => setExcluded(new Set())}
				/>
			) : null}
		</div>
	);
}

export function SyncReviewPage() {
	const [step] = useQueryState("step", reviewStepParser);
	const [field, setField] = useQueryState("field", reviewFieldParser);
	const copy = STEP_COPY[step];
	return (
		<div className="min-w-0 space-y-4">
			<Button variant="ghost" size="sm" asChild className="-ml-3">
				<Link to="/data">
					<ArrowLeft />
					Огляд
				</Link>
			</Button>
			<div className="space-y-1">
				<h2 className="text-lg font-medium">{copy.title}</h2>
				<p className="text-sm text-muted-foreground">{copy.hint}</p>
			</div>
			{step === "questions" ? (
				<SyncQuestionList />
			) : (
				<ChangeList
					key={step}
					step={step}
					field={field}
					onField={(next) => void setField(next)}
				/>
			)}
		</div>
	);
}

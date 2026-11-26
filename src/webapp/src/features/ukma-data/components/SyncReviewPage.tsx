import { useState } from "react";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useQueryState } from "nuqs";

import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import type {
	SyncPendingResponse,
	SyncPreviewRequest,
} from "@/lib/api/generated";
import { ukmaDataSyncPendingList } from "@/lib/api/generated";
import { fieldLabel } from "../sync";
import { formatCount } from "../syncFormat";
import { LIST_PAGE_SIZE } from "../syncLabels";
import { reviewFieldParser, reviewStepParser } from "../syncPreviewParams";
import { PREVIEW_ROWS_QUERY_KEY } from "../syncQueries";
import { STEP_COPY } from "../syncSteps";
import type { ReviewStep } from "../syncSteps";
import { DataSegments } from "./DataBits";
import { SyncApplyBar } from "./SyncApplyBar";
import { SyncQuestionList } from "./SyncQuestionList";
import {
	SyncReviewHeader,
	SyncReviewRow,
	SyncReviewSkeleton,
} from "./SyncReviewRows";
import { UkmaDataError } from "./UkmaDataError";

const ALL_FIELDS = "all";

function FieldFilter({
	page,
	field,
	onChange,
}: Readonly<{
	page: SyncPendingResponse;
	field: string | null;
	onChange: (field: string | null) => void;
}>) {
	const fields = Object.entries(page.changed_fields);
	if (fields.length < 2) {
		return null;
	}
	return (
		<DataSegments
			label="Яке поле змінюється"
			value={field ?? ALL_FIELDS}
			onChange={(value) => onChange(value === ALL_FIELDS ? null : value)}
			items={[
				{ value: ALL_FIELDS, label: "Усі поля" },
				...fields.map(([name, count]) => ({
					value: name,
					label: fieldLabel(name),
					count,
				})),
			]}
		/>
	);
}

function usePendingRows(step: ReviewStep, field: string | null) {
	const { group, rated, match } = STEP_COPY[step].slice;
	return useInfiniteQuery({
		queryKey: [PREVIEW_ROWS_QUERY_KEY, step, field],
		queryFn: ({ pageParam, signal }) =>
			ukmaDataSyncPendingList(
				{
					source: "catalog",
					group: group === "other" ? undefined : group,
					rated: rated ?? undefined,
					match: match ?? undefined,
					changed_field: field ?? undefined,
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
	const rows = usePendingRows(step, field);
	const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());
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
		changed_field: field,
		run: first.runs[0]?.id ?? null,
		exclude_ids: left,
	};
	return (
		<div className="space-y-4">
			<FieldFilter
				page={first}
				field={field}
				onChange={(next) => {
					setExcluded(new Set());
					onField(next);
				}}
			/>
			{items.length === 0 ? (
				<p className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground sm:px-5">
					Тут уже нічого не чекає.
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
				<Link to="/data/sync" search={{ tab: "pending" }}>
					<ArrowLeft />
					Чекають рішення
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

import { useRef, useState } from "react";

import { ArrowLeft, Inbox } from "lucide-react";
import { useQueryStates } from "nuqs";

import { Badge } from "@/components/ui/Badge";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type {
	SyncChange,
	SyncSourceEnum,
	SyncSummary,
} from "@/lib/api/generated";
import { useUkmaDataSyncPendingList } from "@/lib/api/generated";
import { isSyncKind } from "../sync";
import { formatCount } from "../syncFormat";
import { LIST_PAGE_SIZE } from "../syncLabels";
import { listParams } from "../syncParams";
import {
	parseFacets,
	pendingParams,
	RISK_BADGE,
	RISK_LABELS,
	selectionFilter,
	STEP_RISK,
	STEP_TITLES,
} from "../syncReview";
import type { ListState, ListStep } from "../syncReview";
import type { ApplyRequest } from "./SyncApplyDialog";
import { SyncApplyDialog } from "./SyncApplyDialog";
import { SyncChangeDrawer } from "./SyncChangeDrawer";
import { SyncChangeRow } from "./SyncChangeRow";
import { SyncGroupActions } from "./SyncGroupActions";
import { SyncGroupFilters } from "./SyncGroupFilters";
import type { KindOption } from "./SyncGroupFilters";
import { SyncPagination } from "./SyncPagination";
import { UkmaDataError } from "./UkmaDataError";

interface GroupListProps {
	step: ListStep;
	source: SyncSourceEnum;
	summary: SyncSummary;
	onBack: () => void;
}

function kindOptions(summary: SyncSummary, step: ListStep): KindOption[] {
	const found = summary.steps.find((item) => item.step === step);
	if (found === undefined) {
		return [];
	}
	return Object.entries(found.kinds)
		.flatMap(([kind, count]) => (isSyncKind(kind) ? [{ kind, count }] : []))
		.sort((left, right) => right.count - left.count);
}

function ListSkeleton() {
	return (
		<div className="space-y-2" aria-busy="true" aria-label="Завантаження">
			{Array.from({ length: 6 }, (_, index) => (
				<Skeleton key={index} className="h-[4.75rem] rounded-md" />
			))}
		</div>
	);
}

export function SyncGroupList({
	step,
	source,
	summary,
	onBack,
}: Readonly<GroupListProps>) {
	const [params, setParams] = useQueryStates(listParams);
	const [opened, setOpened] = useState<SyncChange | null>(null);
	const [apply, setApply] = useState<ApplyRequest | null>(null);
	const [seen, setSeen] = useState<ReadonlySet<number>>(new Set());
	const rowRefs = useRef(new Map<number, HTMLButtonElement>());
	const kinds = kindOptions(summary, step);
	const kind = params.kind ?? kinds[0]?.kind ?? null;
	const stepSummary = summary.steps.find((item) => item.step === step);
	const similarCount =
		kind === "new_course"
			? (parseFacets(stepSummary?.facets).similarExisting ?? 0)
			: null;
	const state: ListState = {
		kind,
		q: params.q,
		rated: params.rated,
		similar: params.facet === "similar" && kind === "new_course",
	};
	const filterKey = JSON.stringify(state);
	const [seenKey, setSeenKey] = useState(filterKey);
	const query = useUkmaDataSyncPendingList(
		pendingParams(
			selectionFilter(step, state, "list"),
			{ source, run: summary.run.id },
			{
				mode: params.view,
				seed: params.seed,
				page: params.page,
				size: LIST_PAGE_SIZE,
			},
		),
		{ query: { retry: false } },
	);
	const items = query.data?.items ?? [];
	if (seenKey !== filterKey) {
		setSeenKey(filterKey);
		setSeen(new Set());
	} else if (items.some((item) => !seen.has(item.id))) {
		setSeen(new Set([...seen, ...items.map((item) => item.id)]));
	}
	const reset = { page: null, ids: null };
	const kindCount = kinds.find((item) => item.kind === kind)?.count ?? 0;
	const bulkCount =
		params.q.length > 0 || params.rated
			? null
			: kindCount - (similarCount ?? 0);
	const closeDrawer = () => {
		const id = opened?.id;
		setOpened(null);
		if (id !== undefined) {
			rowRefs.current.get(id)?.focus();
		}
	};
	const risk = STEP_RISK[step];
	return (
		<div className="min-w-0 space-y-4 pb-24">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-wrap items-center gap-2">
					<Button variant="ghost" size="sm" onClick={onBack}>
						<ArrowLeft />
						Розгляд
					</Button>
					<h2 className="text-lg font-semibold">
						{STEP_TITLES[step]} ·{" "}
						<span className="tabular-nums">
							{formatCount(stepSummary?.count ?? 0)}
						</span>
					</h2>
				</div>
				<Badge variant={RISK_BADGE[risk]}>{RISK_LABELS[risk]}</Badge>
			</div>
			<SyncGroupFilters
				kinds={kinds}
				kind={kind}
				q={params.q}
				rated={params.rated}
				view={params.view}
				similar={state.similar}
				similarCount={similarCount}
				onKind={(next) => void setParams({ ...reset, kind: next, facet: null })}
				onSearch={(q) =>
					void setParams({ ...reset, q: q.length > 0 ? q : null })
				}
				onRated={(rated) => void setParams({ ...reset, rated: rated || null })}
				onView={(view) => void setParams({ page: null, view })}
				onSimilar={(similar) =>
					void setParams({ ...reset, facet: similar ? "similar" : null })
				}
				onReseed={() => void setParams({ page: null, seed: params.seed + 1 })}
			/>
			{query.isLoading ? <ListSkeleton /> : null}
			{query.error ? (
				<UkmaDataError
					error={query.error}
					title="Не вдалося завантажити зміни"
					onRetry={() => void query.refetch()}
					isRetrying={query.isRefetching}
				/>
			) : null}
			{query.data && items.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Inbox />
						</EmptyMedia>
						<EmptyTitle>Нічого не знайдено</EmptyTitle>
						<EmptyDescription>
							За цим фільтром нічого не чекає.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : null}
			{items.length > 0 ? (
				<ul
					aria-label={STEP_TITLES[step]}
					className="rounded-lg border bg-card px-3"
				>
					{items.map((change) => (
						<SyncChangeRow
							key={change.id}
							ref={(node) => {
								if (node === null) {
									rowRefs.current.delete(change.id);
								} else {
									rowRefs.current.set(change.id, node);
								}
							}}
							change={change}
							selected={params.ids.includes(change.id)}
							selectable={params.ids.length < 200}
							onSelect={(selected) =>
								void setParams({
									ids: selected
										? [...params.ids, change.id]
										: params.ids.filter((id) => id !== change.id),
								})
							}
							onOpen={() => setOpened(change)}
						/>
					))}
				</ul>
			) : null}
			{query.data && query.data.total_pages > 1 ? (
				<SyncPagination
					page={query.data.page}
					totalPages={query.data.total_pages}
					nextPage={query.data.next_page}
					previousPage={query.data.previous_page}
					onPageChange={(next) => void setParams({ page: next })}
				/>
			) : null}
			<SyncGroupActions
				selected={params.ids}
				bulkCount={state.similar ? undefined : bulkCount}
				seen={seen.size}
				similarExcluded={
					kind === "new_course" && !state.similar ? similarCount : null
				}
				onApplySelected={() =>
					setApply({
						step,
						title: `Застосувати вибрані: ${formatCount(params.ids.length)}`,
						selection: { change_ids: params.ids },
					})
				}
				onApplyAll={() =>
					setApply({
						step,
						title: `${STEP_TITLES[step]}: усі за фільтром`,
						selection: { filter: selectionFilter(step, state, "bulk") },
					})
				}
				onRejected={() => void setParams({ ids: null })}
			/>
			<SyncChangeDrawer change={opened} onClose={closeDrawer} />
			{apply === null ? null : (
				<SyncApplyDialog
					request={apply}
					source={source}
					run={summary.run.id}
					onClose={() => setApply(null)}
					onApplied={() => void setParams({ ids: null })}
					onNextStep={() => {
						setApply(null);
						onBack();
					}}
				/>
			)}
		</div>
	);
}

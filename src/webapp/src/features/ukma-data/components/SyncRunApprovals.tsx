import { Download, ListChecks } from "lucide-react";
import { useQueryStates } from "nuqs";

import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Label } from "@/components/ui/Label";
import { Skeleton } from "@/components/ui/Skeleton";
import { env } from "@/env";
import type { SyncApprovalDetail } from "@/lib/api/generated";
import {
	getUkmaDataSyncRunExportQueryKey,
	useUkmaDataSyncRunApprovalsList,
} from "@/lib/api/generated";
import { useCurrentEmail } from "../hooks/useSyncApplyLock";
import {
	countWith,
	formatCount,
	formatDayTime,
	PLANS,
	RATINGS,
} from "../syncFormat";
import { ACTION_LABELS, OUTCOME_LABELS } from "../syncLabels";
import { historyParams } from "../syncParams";
import { approvalCounts, sameDay } from "../syncReview";
import { approverName } from "./SyncActiveBanner";
import { UkmaDataError } from "./UkmaDataError";

function outcomeVariant(
	outcome: SyncApprovalDetail["outcome"],
): "success" | "soft-destructive" | "outline" {
	if (outcome === "applied") {
		return "success";
	}
	return outcome === "started" ? "outline" : "soft-destructive";
}

function ApprovalItem({
	approval,
	currentEmail,
}: Readonly<{ approval: SyncApprovalDetail; currentEmail: string | null }>) {
	const counts = approvalCounts(approval.counts);
	return (
		<li className="space-y-1.5 border-b py-3 text-sm last:border-b-0">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="soft">{ACTION_LABELS[approval.action]}</Badge>
				<Badge variant={outcomeVariant(approval.outcome)}>
					{OUTCOME_LABELS[approval.outcome]}
				</Badge>
				<span className="text-muted-foreground tabular-nums">
					{approverName(approval.user_email, currentEmail)} ·{" "}
					{formatDayTime(approval.created_at)}
				</span>
			</div>
			<p className="break-words">{approval.selection}</p>
			<p className="text-muted-foreground tabular-nums">
				застосовано {formatCount(counts.applied)} · уже неактуальні{" "}
				{formatCount(counts.superseded)} · чекають {formatCount(counts.waiting)}
				{counts.rejected > 0
					? ` · відхилено ${formatCount(counts.rejected)}`
					: ""}
				{approval.ratings_moved > 0 || approval.plans_moved > 0
					? ` · перенесено ${countWith(approval.ratings_moved, RATINGS)}, ${countWith(approval.plans_moved, PLANS)}`
					: ""}
			</p>
			{approval.error ? (
				<p className="text-destructive">{approval.error}</p>
			) : null}
			{approval.merged.length > 0 ? (
				<ul className="space-y-0.5" aria-label="Обʼєднані курси">
					{approval.merged.map((merge) => (
						<li
							key={`${merge.from_id}-${merge.into_id}`}
							className="break-words"
						>
							«{merge.title}»: {merge.from_id} →{" "}
							<a
								href={`/courses/${merge.into_id}`}
								className="text-primary underline-offset-4 hover:underline"
							>
								{merge.into_id}
							</a>
						</li>
					))}
				</ul>
			) : null}
		</li>
	);
}

export function SyncRunApprovals({ runId }: Readonly<{ runId: number }>) {
	const [{ mine }, setParams] = useQueryStates(historyParams);
	const currentEmail = useCurrentEmail();
	const query = useUkmaDataSyncRunApprovalsList(
		runId,
		{ page_size: 100 },
		{ query: { retry: false } },
	);
	const items = (query.data?.items ?? []).filter(
		(item) =>
			!mine ||
			(item.user_email !== null &&
				item.user_email === currentEmail &&
				sameDay(item.created_at)),
	);
	const csv = `${env.VITE_API_BASE_URL}${getUkmaDataSyncRunExportQueryKey(runId)[0]}`;
	return (
		<section aria-labelledby="sync-decisions" className="space-y-3">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<h3 id="sync-decisions" className="text-base font-semibold">
					Рішення
				</h3>
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<div className="flex items-center gap-2">
						<Checkbox
							id="sync-mine"
							checked={mine}
							onCheckedChange={(value) =>
								void setParams({ mine: value === true || null })
							}
						/>
						<Label htmlFor="sync-mine" className="font-normal">
							Ця сесія
						</Label>
					</div>
					<a
						href={csv}
						download
						className={buttonVariants({ variant: "outline", size: "sm" })}
					>
						<Download />
						Завантажити CSV
					</a>
				</div>
			</div>
			{query.isLoading ? <Skeleton className="h-24 rounded-lg" /> : null}
			{query.error ? (
				<UkmaDataError
					error={query.error}
					title="Не вдалося завантажити рішення"
					onRetry={() => void query.refetch()}
					isRetrying={query.isRefetching}
				/>
			) : null}
			{query.data && items.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<ListChecks />
						</EmptyMedia>
						<EmptyTitle>Рішень ще немає</EmptyTitle>
						<EmptyDescription>
							{mine
								? "Сьогодні ви нічого не застосовували в цьому запуску."
								: "Кожне застосування чи відхилення запишеться сюди."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : null}
			{items.length > 0 ? (
				<ul
					aria-label="Рішення запуску"
					className="rounded-lg border bg-card px-3"
				>
					{items.map((approval) => (
						<ApprovalItem
							key={approval.id}
							approval={approval}
							currentEmail={currentEmail}
						/>
					))}
				</ul>
			) : null}
		</section>
	);
}

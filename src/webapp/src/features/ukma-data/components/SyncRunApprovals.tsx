import { Download, ListChecks } from "lucide-react";

import { buttonVariants } from "@/components/ui/Button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import { env } from "@/env";
import type { SyncApprovalDetail } from "@/lib/api/generated";
import {
	getUkmaDataSyncRunExportQueryKey,
	useUkmaDataSyncRunApprovalsList,
} from "@/lib/api/generated";
import { countWith, formatCount, PLANS, RATINGS } from "../syncFormat";
import {
	approvalCounts,
	approvalTerm,
	approverName,
	NO_RETRY,
} from "../syncOverview";
import { Ago, Term } from "./Term";
import { UkmaDataError } from "./UkmaDataError";

function countsLine(approval: SyncApprovalDetail): string {
	const counts = approvalCounts(approval.counts);
	const parts =
		approval.action === "revert"
			? [`відкочено ${formatCount(counts.reverted)}`]
			: approval.action === "reject"
				? [`відхилено ${formatCount(counts.rejected)}`]
				: [
						`застосовано ${formatCount(counts.applied)}`,
						`неактуальні ${formatCount(counts.superseded)}`,
						`чекають ${formatCount(counts.waiting)}`,
					];
	if (approval.ratings_moved > 0 || approval.plans_moved > 0) {
		parts.push(
			`перенесено ${countWith(approval.ratings_moved, RATINGS)}, ${countWith(approval.plans_moved, PLANS)}`,
		);
	}
	return parts.join(" · ");
}

function ApprovalItem({
	approval,
}: Readonly<{ approval: SyncApprovalDetail }>) {
	const term = approvalTerm(approval);
	return (
		<li className="space-y-1 py-3 text-sm">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
				<span className="font-medium">
					{term === null ? (
						<span className="text-destructive">Не вдалося</span>
					) : (
						<Term name={term} />
					)}
				</span>
				<span className="break-words">{approval.selection}</span>
				<span className="text-muted-foreground">
					· {approverName(approval.user_email)},{" "}
					<Ago iso={approval.created_at} />
				</span>
			</div>
			<p className="text-muted-foreground tabular-nums">
				{countsLine(approval)}
			</p>
			{approval.error ? (
				<p className="text-destructive">{approval.error}</p>
			) : null}
			{approval.merged.length > 0 ? (
				<ul className="space-y-0.5" aria-label="Обʼєднані дисципліни">
					{approval.merged.map((merge) => (
						<li
							key={`${merge.from_id}-${merge.into_id}`}
							className="break-words"
						>
							«{merge.title}» об'єднано в{" "}
							<a
								href={`/courses/${merge.into_id}`}
								className="text-primary underline-offset-4 hover:underline"
							>
								цю дисципліну
							</a>
						</li>
					))}
				</ul>
			) : null}
		</li>
	);
}

export function SyncRunApprovals({ runId }: Readonly<{ runId: number }>) {
	const query = useUkmaDataSyncRunApprovalsList(
		runId,
		{ page_size: 100 },
		NO_RETRY,
	);
	const items = query.data?.items ?? [];
	const csv = `${env.VITE_API_BASE_URL}${getUkmaDataSyncRunExportQueryKey(runId)[0]}`;
	return (
		<section aria-labelledby="sync-decisions" className="space-y-3">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-1">
					<h3 id="sync-decisions" className="text-base font-medium">
						Рішення
					</h3>
					<p className="text-sm text-muted-foreground">
						Що застосували чи відхилили з цього читання, хто й коли.
					</p>
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
							Кожне застосування, відхилення чи відкат запишеться сюди.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : null}
			{items.length > 0 ? (
				<ul
					aria-label="Рішення читання"
					className="divide-y rounded-lg border bg-card px-4"
				>
					{items.map((approval) => (
						<ApprovalItem key={approval.id} approval={approval} />
					))}
				</ul>
			) : null}
		</section>
	);
}

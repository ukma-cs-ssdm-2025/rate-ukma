import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUkmaDataSyncSummary } from "@/lib/api/generated";
import { countsSummary, runStatusVariant } from "../sync";
import { formatCount } from "../syncFormat";
import { RUN_STATUS_LABELS, SOURCE_LABELS } from "../syncLabels";
import { failedRunLabel, skipReasonLabel } from "../syncReasons";
import { SyncRunApprovals } from "./SyncRunApprovals";
import { SyncRunChanges } from "./SyncRunChanges";
import { Ago, Term } from "./Term";

function RunHeader({ runId }: Readonly<{ runId: number }>) {
	const { data, isLoading } = useUkmaDataSyncSummary(
		{ run: runId },
		{ query: { retry: false } },
	);
	if (isLoading) {
		return <Skeleton className="h-20 rounded-lg" />;
	}
	if (data === undefined) {
		return null;
	}
	const run = data.run;
	const counts = countsSummary(run.counts);
	const skipped = Object.entries(data.not_proposed).filter(
		([, value]) => value.count > 0,
	);
	return (
		<div className="space-y-2 rounded-lg border bg-card p-4 text-sm">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant={runStatusVariant(run.status)}>
					{RUN_STATUS_LABELS[run.status]}
				</Badge>
				<Badge variant="outline">{SOURCE_LABELS[run.source]}</Badge>
				<span className="text-muted-foreground">
					почалось <Ago iso={run.started_at} />
					{run.data_updated_at === null ? null : (
						<>
							{" "}
							· дані САЗ станом на <Ago iso={run.data_updated_at} />
						</>
					)}
				</span>
			</div>
			{run.status === "failed" ? (
				<p className="text-destructive">{failedRunLabel(run.error)}</p>
			) : null}
			{counts.length > 0 ? (
				<p className="text-muted-foreground tabular-nums">
					{counts.join(" · ")}
				</p>
			) : null}
			{skipped.length > 0 ? (
				<p className="text-muted-foreground tabular-nums">
					<Term name="skipped" />:{" "}
					{skipped
						.map(
							([reason, value]) =>
								`${skipReasonLabel(reason)} ${formatCount(value.count)}`,
						)
						.join(" · ")}
				</p>
			) : null}
		</div>
	);
}

export function SyncRunPage({
	runId,
	onBack,
}: Readonly<{ runId: number; onBack: () => void }>) {
	return (
		<div className="min-w-0 space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Button variant="ghost" size="sm" onClick={onBack}>
					<ArrowLeft />
					Журнал
				</Button>
				<h2 className="text-lg font-medium">Читання САЗ #{runId}</h2>
			</div>
			<RunHeader runId={runId} />
			<SyncRunApprovals runId={runId} />
			<section aria-labelledby="sync-run-changes" className="space-y-3">
				<h3 id="sync-run-changes" className="text-base font-medium">
					Зміни
				</h3>
				<SyncRunChanges runId={runId} />
			</section>
		</div>
	);
}

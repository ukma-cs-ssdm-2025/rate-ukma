import { AlertTriangle, History } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { SyncSummary } from "@/lib/api/generated";
import { useUkmaDataSyncRunsList } from "@/lib/api/generated";
import { formatDayTime, formatHoursAgo, hoursSince } from "../syncFormat";
import { failedRunLabel } from "../syncReasons";

export function SyncRunHeader({ summary }: Readonly<{ summary: SyncSummary }>) {
	const updated = summary.run.data_updated_at;
	return (
		<p className="text-sm text-muted-foreground tabular-nums">
			Запуск {summary.run.id} ·{" "}
			{updated === null
				? "дата даних UKMA Data невідома"
				: `дані UKMA Data від ${formatDayTime(updated)} (${formatHoursAgo(hoursSince(updated))})`}
		</p>
	);
}

export function SyncRunBanners({
	summary,
	onLatest,
}: Readonly<{ summary: SyncSummary; onLatest: () => void }>) {
	const latest = useUkmaDataSyncRunsList(
		{ source: summary.run.source, page_size: 1 },
		{ query: { retry: false } },
	);
	const newest = latest.data?.items[0];
	const failed =
		newest !== undefined &&
		newest.status === "failed" &&
		newest.id > summary.run.id
			? newest
			: null;
	return (
		<>
			{summary.newer_run_id === null ? null : (
				<div
					role="status"
					className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
				>
					<p className="flex items-start gap-2">
						<History className="mt-0.5 size-4 shrink-0" />
						Є новіший запуск. Ваші відповіді збережено; зміни цього запуску вже
						неактуальні.
					</p>
					<Button size="sm" className="w-full sm:w-auto" onClick={onLatest}>
						Перейти до нового
					</Button>
				</div>
			)}
			{failed === null ? null : (
				<div
					role="alert"
					className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
				>
					<AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
					<p>
						Останній запуск ({formatDayTime(failed.started_at)}) не завершився:{" "}
						{failedRunLabel(failed.error)}. Розглядати можна попередній успішний
						запуск.
					</p>
				</div>
			)}
		</>
	);
}

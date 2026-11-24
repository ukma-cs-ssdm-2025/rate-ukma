import { Skeleton } from "@/components/ui/Skeleton";
import type { SyncSummary } from "@/lib/api/generated";
import { formatCount } from "../syncFormat";
import { changesText, skippedReasons } from "../syncOverview";
import { inboxSteps } from "../syncSteps";
import { SyncStepList } from "./SyncStepList";
import { DataSection, Term } from "./Term";

function Skipped({ summary }: Readonly<{ summary: SyncSummary }>) {
	const reasons = skippedReasons(summary);
	if (reasons.length === 0) {
		return null;
	}
	const total = reasons.reduce((sum, reason) => sum + reason.count, 0);
	return (
		<p className="text-sm text-muted-foreground">
			<Term name="skipped" /> {formatCount(total)} рядків САЗ:{" "}
			{reasons
				.map(
					(reason) =>
						`${reason.label.toLowerCase()} ${formatCount(reason.count)}`,
				)
				.join(", ")}
			.
		</p>
	);
}

export function OverviewWaiting({
	summary,
	loading,
}: Readonly<{ summary: SyncSummary | null; loading: boolean }>) {
	const steps = summary === null ? [] : inboxSteps(summary);
	const total = steps.reduce((sum, item) => sum + item.count, 0);
	return (
		<DataSection
			title="Що чекає рішення"
			lead="Зміни з САЗ, які ще ніхто не застосував і не відклав. Ідіть згори донизу."
		>
			{loading ? <Skeleton className="h-40 rounded-xl" /> : null}
			{summary === null && !loading ? (
				<p className="text-sm text-muted-foreground">
					Поки нічого не чекає: зміни зʼявляться після першого читання САЗ.
				</p>
			) : null}
			{summary !== null && total === 0 ? (
				<p className="rounded-xl border bg-tint-success px-4 py-3 text-sm text-tint-success-foreground">
					Нічого не чекає. Наступне читання САЗ уночі.
				</p>
			) : null}
			{steps.length > 0 ? <SyncStepList steps={steps} /> : null}
			{summary !== null && total > 0 ? (
				<p className="text-sm text-muted-foreground">
					Разом {changesText(total)}.
				</p>
			) : null}
			{summary === null ? null : <Skipped summary={summary} />}
		</DataSection>
	);
}

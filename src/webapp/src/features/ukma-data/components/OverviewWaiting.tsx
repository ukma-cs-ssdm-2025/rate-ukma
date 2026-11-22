import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { Skeleton } from "@/components/ui/Skeleton";
import type { SyncSummary } from "@/lib/api/generated";
import { formatCount } from "../syncFormat";
import {
	changesText,
	groupCounts,
	kindParts,
	skippedReasons,
} from "../syncOverview";
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
	const groups = summary === null ? [] : groupCounts(summary);
	const total = groups.reduce((sum, group) => sum + group.count, 0);
	return (
		<DataSection
			title="Що чекає рішення"
			lead={
				<>
					Зміни, які ще ніхто не застосував і не відхилив, по групах. Рішення
					ухвалюють у <Term name="console" />.
				</>
			}
		>
			{loading ? <Skeleton className="h-40 rounded-xl" /> : null}
			{summary !== null && total === 0 ? (
				<p className="rounded-xl border bg-tint-success px-4 py-3 text-sm text-tint-success-foreground">
					Нічого не чекає. Наступне читання САЗ — уночі.
				</p>
			) : null}
			{summary !== null && total > 0 ? (
				<ul
					aria-label="Що чекає рішення"
					className="divide-y overflow-hidden rounded-xl border bg-card"
				>
					{groups.map((group) => (
						<li key={group.group}>
							<Link
								to="/data/sync"
								search={{ group: group.group }}
								className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 sm:px-5"
							>
								<span className="w-24 shrink-0 font-medium sm:w-28">
									<Term name={group.group} />
								</span>
								<span className="w-16 shrink-0 text-right text-lg font-semibold tabular-nums sm:w-20">
									{formatCount(group.count)}
								</span>
								<span className="min-w-0 flex-1 text-sm text-muted-foreground">
									{group.count === 0 ? "нічого" : kindParts(group.kinds)}
									{group.rated > 0
										? ` · з оцінками ${formatCount(group.rated)}`
										: ""}
								</span>
								<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
							</Link>
						</li>
					))}
				</ul>
			) : null}
			{summary !== null && total > 0 ? (
				<p className="text-sm text-muted-foreground">
					Разом {changesText(total)}.
				</p>
			) : null}
			{summary === null ? null : <Skipped summary={summary} />}
		</DataSection>
	);
}

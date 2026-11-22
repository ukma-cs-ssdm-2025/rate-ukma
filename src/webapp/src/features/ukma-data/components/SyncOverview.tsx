import { CheckCircle2, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { SyncSummary } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import type { DoneBanner } from "../syncConfirm";
import { formatCount, formatDayMonthTime, formatTime } from "../syncFormat";
import type { DoneLine, GroupLine, SyncView } from "../syncGroups";
import { skipReasonLabel } from "../syncReasons";
import { RECORDS, word } from "../syncWords";
import { SyncChip } from "./SyncBits";
import { SyncExplainer } from "./SyncExplainer";

export function SyncDoneBanner({
	banner,
	onHistory,
	onDismiss,
}: Readonly<{
	banner: DoneBanner;
	onHistory: () => void;
	onDismiss: () => void;
}>) {
	return (
		<div
			role="status"
			className="flex items-start gap-3 rounded-xl border border-success/40 bg-tint-success px-4 py-3"
		>
			<CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
			<div className="min-w-0 flex-1 text-sm">
				<p className="font-semibold">{banner.title}</p>
				<p className="text-muted-foreground">
					{banner.detail}{" "}
					<button
						type="button"
						onClick={onHistory}
						className="text-primary hover:underline"
					>
						Відкрити в історії
					</button>
				</p>
			</div>
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label="Закрити"
				onClick={onDismiss}
			>
				<X />
			</Button>
		</div>
	);
}

function Lead({
	summary,
	remaining,
}: Readonly<{ summary: SyncSummary; remaining: number }>) {
	const { run } = summary;
	const updated = run.data_updated_at ?? run.finished_at;
	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
			<div className="space-y-1">
				<h2 className="text-2xl font-semibold tracking-tight">
					Що змінилось у САЗ
				</h2>
				<p className="text-sm text-muted-foreground">
					{updated ? `Дані САЗ станом на ${formatDayMonthTime(updated)}` : null}
					{run.finished_at
						? ` · перевірено о ${formatTime(run.finished_at)}`
						: null}
				</p>
			</div>
			<p className="text-sm text-muted-foreground">
				Залишилось вирішити{" "}
				<span className="ml-1 text-2xl font-semibold text-foreground tabular-nums">
					{formatCount(remaining)}
				</span>
			</p>
		</div>
	);
}

function Line({
	line,
	primary,
	onAction,
	onOpen,
}: Readonly<{
	line: GroupLine;
	primary: boolean;
	onAction: (line: GroupLine) => void;
	onOpen: (view: SyncView) => void;
}>) {
	return (
		<li className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
			<div className="min-w-0 max-w-3xl space-y-1.5">
				<h3 className="text-lg font-semibold">{line.title}</h3>
				<p className="text-sm text-muted-foreground">{line.effect}</p>
				<SyncChip chip={line.chip} />
			</div>
			<div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
				<Button
					size="lg"
					variant={primary ? "default" : "outline"}
					onClick={() => onAction(line)}
				>
					{line.action.label}
				</Button>
				{line.link ? (
					<Button
						variant="link"
						className="h-auto p-0"
						onClick={() => {
							if (line.link) {
								onOpen(line.link.view);
							}
						}}
					>
						{line.link.label}
					</Button>
				) : null}
			</div>
		</li>
	);
}

function Done({
	line,
	onHistory,
}: Readonly<{ line: DoneLine; onHistory: (runId: number) => void }>) {
	return (
		<li className="flex flex-col gap-2 bg-tint-success px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
			<div className="space-y-1">
				<h3 className="text-lg font-semibold text-tint-success-foreground">
					{line.title}
				</h3>
				<p className="text-sm text-muted-foreground">{line.detail}</p>
			</div>
			<Button
				variant="link"
				className="h-auto justify-start p-0"
				onClick={() => onHistory(line.runId)}
			>
				Відкрити в історії
			</Button>
		</li>
	);
}

function NotTaken({ summary }: Readonly<{ summary: SyncSummary }>) {
	const reasons = Object.entries(summary.not_proposed).filter(
		([, item]) => item.count > 0,
	);
	const total = reasons.reduce((sum, [, item]) => sum + item.count, 0);
	if (total === 0) {
		return null;
	}
	return (
		<details className="text-sm text-muted-foreground">
			<summary className="cursor-pointer">
				Ще {formatCount(total)} {word(total, RECORDS)} САЗ не потрапили сюди —
				чому
			</summary>
			<ul className="mt-2 list-disc space-y-1 pl-6">
				{reasons.map(([reason, item]) => (
					<li key={reason}>
						{formatCount(item.count)} — {skipReasonLabel(reason).toLowerCase()}
					</li>
				))}
			</ul>
			<p className="mt-2">
				Вони з'являться тут, щойно в САЗ виправлять ці поля.
			</p>
		</details>
	);
}

export function SyncOverview({
	summary,
	remaining,
	lines,
	done,
	onAction,
	onOpen,
	onHistory,
}: Readonly<{
	summary: SyncSummary;
	remaining: number;
	lines: readonly GroupLine[];
	done: readonly DoneLine[];
	onAction: (line: GroupLine) => void;
	onOpen: (view: SyncView) => void;
	onHistory: (runId: number) => void;
}>) {
	return (
		<div className="space-y-6">
			<Lead summary={summary} remaining={remaining} />
			<SyncExplainer />
			<ul
				aria-label="Групи змін"
				className={cn(
					"divide-y overflow-hidden rounded-xl border bg-card",
					lines.length + done.length === 0 && "hidden",
				)}
			>
				{lines.map((line, index) => (
					<Line
						key={line.key}
						line={line}
						primary={index === 0}
						onAction={onAction}
						onOpen={onOpen}
					/>
				))}
				{done.map((line) => (
					<Done key={line.key} line={line} onHistory={onHistory} />
				))}
			</ul>
			<NotTaken summary={summary} />
		</div>
	);
}

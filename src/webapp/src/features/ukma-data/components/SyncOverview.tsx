import { CheckCircle2, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { SyncSummary } from "@/lib/api/generated";
import type { DoneBanner } from "../syncConfirm";
import { formatCount, freshnessText } from "../syncFormat";
import type { DoneLine, GroupLine, SyncView } from "../syncGroups";
import { skipReasonLabel } from "../syncReasons";
import { RECORDS, word } from "../syncWords";
import { DataLead } from "./DataLead";
import { DataDoneLine, DataLine, DataLines } from "./DataLines";
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

const CONFIRM_FIRST =
	"Спершу покажемо, що саме зміниться; на сайті нічого не зміниться, доки ви не підтвердите.";

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
	const { link } = line;
	return (
		<DataLine
			title={line.title}
			effect={line.effect}
			chip={<SyncChip chip={line.chip} />}
			action={
				<>
					<Button
						size="lg"
						variant={primary ? "default" : "outline"}
						onClick={() => onAction(line)}
					>
						{line.action.label}
					</Button>
					{line.key === "links" ? (
						<p className="max-w-64 text-xs text-muted-foreground sm:text-right">
							{CONFIRM_FIRST}
						</p>
					) : null}
					{link ? (
						<Button
							variant="link"
							className="h-auto p-0"
							onClick={() => onOpen(link.view)}
						>
							{link.label}
						</Button>
					) : null}
				</>
			}
		/>
	);
}

function Done({
	line,
	onHistory,
}: Readonly<{ line: DoneLine; onHistory: (runId: number) => void }>) {
	return (
		<DataDoneLine
			title={line.title}
			detail={line.detail}
			action={
				<Button
					variant="link"
					className="h-auto justify-start p-0"
					onClick={() => onHistory(line.runId)}
				>
					Відкрити в історії
				</Button>
			}
		/>
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
			<DataLead
				title="Що змінилось у САЗ"
				subtitle={freshnessText(
					summary.run.data_updated_at ?? summary.run.finished_at,
					summary.run.finished_at,
				)}
				remaining={remaining}
			/>
			<SyncExplainer />
			<DataLines label="Групи змін" empty={lines.length + done.length === 0}>
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
			</DataLines>
			<NotTaken summary={summary} />
		</div>
	);
}

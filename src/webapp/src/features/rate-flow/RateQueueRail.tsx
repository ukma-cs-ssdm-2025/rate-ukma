import { Check, ChevronDown } from "lucide-react";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import {
	getDifficultyTone,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import { ProgressBar } from "@/features/ratings/components/MyRatingsHeader";
import { cn } from "@/lib/utils";
import type { ItemState, QueueItem, RateQueue } from "./useRateQueue";

function StatusDot({
	state,
	active,
}: Readonly<{ state: ItemState; active: boolean }>) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex size-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/30",
				state.kind === "done" &&
					"border-primary bg-primary text-primary-foreground",
				state.kind === "skipped" && "border-dashed",
				active && state.kind !== "done" && "border-2 border-primary",
			)}
		>
			{state.kind === "done" ? (
				<Check className="size-3" strokeWidth={3} />
			) : null}
		</span>
	);
}

function RowTrailing({ state }: Readonly<{ state: ItemState }>) {
	if (state.kind === "skipped") {
		return <span className="text-xs text-muted-foreground">Пропущено</span>;
	}
	if (state.kind !== "done") return null;
	const { difficulty, usefulness } = state.scores;
	return (
		<span className="flex gap-2 text-xs font-semibold tabular-nums">
			<span className={getDifficultyTone(difficulty)}>
				<span className="sr-only">Складність </span>
				{difficulty}
			</span>
			<span className={getUsefulnessTone(usefulness)}>
				<span className="sr-only">Корисність </span>
				{usefulness}
			</span>
		</span>
	);
}

function QueueList({
	queue,
	current,
	onPick,
}: Readonly<{
	queue: RateQueue;
	current: QueueItem | null;
	onPick: (item: QueueItem) => void;
}>) {
	return (
		<div className="space-y-5">
			{queue.semesters.map((semester) => (
				<section key={semester.key} aria-label={semester.label}>
					<h2 className="mb-1 px-3 text-sm font-medium text-muted-foreground">
						{semester.label}
					</h2>
					<ul className="space-y-0.5">
						{semester.items.map((item) => {
							const state = queue.stateOf(item);
							const active = current?.offeringId === item.offeringId;
							return (
								<li key={item.offeringId}>
									<button
										type="button"
										onClick={() => onPick(item)}
										aria-current={active ? "step" : undefined}
										className={cn(
											"flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none",
											active && "bg-card-user font-medium hover:bg-card-user",
											!active &&
												state.kind !== "todo" &&
												"text-muted-foreground",
										)}
									>
										<StatusDot state={state} active={active} />
										<span className="min-w-0 flex-1 truncate">
											{item.title}
										</span>
										<RowTrailing state={state} />
									</button>
								</li>
							);
						})}
					</ul>
				</section>
			))}
		</div>
	);
}

function Progress({ queue }: Readonly<{ queue: RateQueue }>) {
	const total = queue.items.length;
	return (
		<div>
			<p className="text-sm font-medium tabular-nums">
				Оцінено {queue.doneCount} з {total}
			</p>
			<ProgressBar share={total ? queue.doneCount / total : 0} />
		</div>
	);
}

interface RateQueueRailProps {
	readonly queue: RateQueue;
	readonly current: QueueItem | null;
	readonly onPick: (item: QueueItem) => void;
}

/** Desktop: every course waiting for a rating, with progress on top. */
export function RateQueueRail({
	queue,
	current,
	onPick,
}: Readonly<RateQueueRailProps>) {
	return (
		<nav aria-label="Курси до оцінки" className="space-y-5">
			<div className="px-3">
				<Progress queue={queue} />
			</div>
			<QueueList queue={queue} current={current} onPick={onPick} />
		</nav>
	);
}

/** Phones: the same progress, with the list folded under it. */
export function RateQueueBar({
	queue,
	current,
	onPick,
	open,
	onOpenChange,
}: Readonly<
	RateQueueRailProps & {
		open: boolean;
		onOpenChange: (open: boolean) => void;
	}
>) {
	return (
		<Collapsible open={open} onOpenChange={onOpenChange}>
			<nav aria-label="Курси до оцінки" className="rounded-xl bg-muted/50 p-4">
				<div className="flex items-start gap-4">
					<div className="min-w-0 flex-1">
						<Progress queue={queue} />
					</div>
					<CollapsibleTrigger className="group -m-1 flex items-center gap-1 rounded-md p-1 text-sm text-primary">
						Усі курси
						<ChevronDown
							className="size-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
							aria-hidden="true"
						/>
					</CollapsibleTrigger>
				</div>
				<CollapsibleContent>
					<div className="-mx-3 pt-4">
						<QueueList
							queue={queue}
							current={current}
							onPick={(item) => {
								onPick(item);
								onOpenChange(false);
							}}
						/>
					</div>
				</CollapsibleContent>
			</nav>
		</Collapsible>
	);
}

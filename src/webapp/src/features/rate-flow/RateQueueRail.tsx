import { ChevronDown } from "lucide-react";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import { ProgressBar } from "@/features/ratings/components/MyRatingsHeader";
import { cn } from "@/lib/utils";
import type { ItemState, QueueItem, RateQueue } from "./useRateQueue";

const RING_RADIUS = 8;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * A ring per course: empty to start, filling a quarter for each answer on
 * the course being rated, closed once saved, dashed when skipped.
 */
export function StatusRing({
	state,
	share,
}: Readonly<{ state: ItemState; share: number }>) {
	const filled = state.kind === "done" ? 1 : share;
	return (
		<svg
			viewBox="0 0 20 20"
			aria-hidden="true"
			className="size-5 shrink-0 -rotate-90"
		>
			<circle
				cx="10"
				cy="10"
				r={RING_RADIUS}
				fill="none"
				strokeWidth="2"
				className={cn(
					"stroke-muted-foreground/25",
					state.kind === "skipped" && "stroke-muted-foreground/60",
				)}
				strokeDasharray={state.kind === "skipped" ? "2.5 2.5" : undefined}
			/>
			<circle
				cx="10"
				cy="10"
				r={RING_RADIUS}
				fill="none"
				strokeWidth="2"
				strokeLinecap="round"
				className="stroke-primary transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
				strokeDasharray={RING_LENGTH}
				strokeDashoffset={RING_LENGTH * (1 - filled)}
				opacity={filled > 0 ? 1 : 0}
			/>
		</svg>
	);
}

const STATE_LABEL: Record<ItemState["kind"], string | null> = {
	todo: null,
	done: "оцінено",
	skipped: "Пропущено",
};

function QueueList({
	queue,
	current,
	activeShare,
	onPick,
}: Readonly<{
	queue: RateQueue;
	current: QueueItem | null;
	activeShare: number;
	onPick: (item: QueueItem) => void;
}>) {
	return (
		<div className="space-y-5">
			{queue.semesters.map((semester) => (
				<section key={semester.key} aria-label={semester.label}>
					<h3 className="mb-1 px-3 text-sm font-medium text-muted-foreground">
						{semester.label}
					</h3>
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
											"flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none",
											active && "bg-card-user font-medium hover:bg-card-user",
											!active &&
												state.kind === "done" &&
												"text-muted-foreground",
										)}
									>
										<StatusRing
											state={state}
											share={active ? activeShare : 0}
										/>
										<span className="min-w-0 flex-1">
											<span className="line-clamp-2">
												{item.title}
												{state.kind === "done" ? (
													<span className="sr-only">, {STATE_LABEL.done}</span>
												) : null}
											</span>
											{state.kind === "skipped" ? (
												<span className="block text-xs font-normal text-muted-foreground">
													<span className="sr-only">, </span>
													{STATE_LABEL.skipped}
												</span>
											) : null}
										</span>
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
			<p className="text-sm text-muted-foreground tabular-nums">
				Оцінено {queue.doneCount} з {total}
			</p>
			<ProgressBar share={total ? queue.doneCount / total : 0} />
		</div>
	);
}

interface RateQueueRailProps {
	readonly queue: RateQueue;
	readonly current: QueueItem | null;
	/** How much of the open course's form is answered, 0 to 1. */
	readonly activeShare: number;
	readonly onPick: (item: QueueItem) => void;
}

/** Desktop: every course waiting for a rating, with progress on top. */
export function RateQueueRail({
	queue,
	current,
	activeShare,
	onPick,
}: Readonly<RateQueueRailProps>) {
	return (
		<nav aria-label="Дисципліни до оцінки" className="space-y-6">
			<div className="space-y-1 px-3">
				<h2 className="text-lg font-semibold tracking-tight">
					Дисципліни до оцінки
				</h2>
				<Progress queue={queue} />
			</div>
			<QueueList
				queue={queue}
				current={current}
				activeShare={activeShare}
				onPick={onPick}
			/>
		</nav>
	);
}

/** Phones: the same progress, with the list folded under it. */
export function RateQueueBar({
	queue,
	current,
	activeShare,
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
			<nav
				aria-label="Дисципліни до оцінки"
				className="rounded-xl bg-muted/50 p-4"
			>
				{/* Count and toggle on one line, the bar under them edge to edge. */}
				<div className="flex items-center justify-between gap-3">
					<p className="text-sm font-medium tabular-nums">
						Оцінено {queue.doneCount} з {queue.items.length}
					</p>
					<CollapsibleTrigger className="group -m-1 flex items-center gap-1 rounded-md p-1 text-sm font-medium text-primary">
						Усі дисципліни
						<ChevronDown
							className="size-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
							aria-hidden="true"
						/>
					</CollapsibleTrigger>
				</div>
				<ProgressBar
					share={queue.items.length ? queue.doneCount / queue.items.length : 0}
					className="w-full"
				/>
				<CollapsibleContent>
					<div className="-mx-3 pt-4">
						<QueueList
							queue={queue}
							current={current}
							activeShare={activeShare}
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

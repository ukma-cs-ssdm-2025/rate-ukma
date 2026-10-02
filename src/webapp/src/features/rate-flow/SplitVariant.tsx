import { useState } from "react";

import { Check, ChevronRight, CornerDownRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Textarea } from "@/components/ui/Textarea";
import { ScoreInput } from "@/features/ratings/components/RatingForm";
import {
	difficultyDescriptions,
	usefulnessDescriptions,
} from "@/features/ratings/definitions/ratingDefinitions";
import { cn } from "@/lib/utils";
import {
	FacultyDot,
	OthersScores,
	ProgressBar,
	useCourseAverages,
} from "./CourseContext";
import type { QueueItem, RateQueue } from "./useRateQueue";

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
		<nav aria-label="Курси до оцінки" className="space-y-5">
			{queue.semesters.map((semester) => (
				<div key={semester.key}>
					<p className="mb-1.5 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
						{semester.label}
					</p>
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
											"flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
											active && "bg-primary/10 font-medium hover:bg-primary/10",
											state.kind !== "todo" && !active && "text-muted-foreground",
										)}
									>
										<span
											className={cn(
												"flex size-5 shrink-0 items-center justify-center rounded-full border",
												state.kind === "done" &&
													"border-primary bg-primary text-primary-foreground",
												active && state.kind === "todo" && "border-primary",
											)}
										>
											{state.kind === "done" ? (
												<Check className="size-3" aria-hidden="true" />
											) : null}
										</span>
										<span className="min-w-0 flex-1 truncate">{item.title}</span>
										{state.kind === "done" ? (
											<span className="text-xs tabular-nums text-muted-foreground">
												{state.scores.difficulty}/{state.scores.usefulness}
											</span>
										) : state.kind === "skipped" ? (
											<span className="text-xs text-muted-foreground">пропущено</span>
										) : null}
									</button>
								</li>
							);
						})}
					</ul>
				</div>
			))}
		</nav>
	);
}

function CoursePanel({
	item,
	queue,
	onDone,
}: Readonly<{
	item: QueueItem;
	queue: RateQueue;
	onDone: () => void;
}>) {
	const [difficulty, setDifficulty] = useState(0);
	const [usefulness, setUsefulness] = useState(0);
	const [comment, setComment] = useState("");
	const [anonymous, setAnonymous] = useState(true);
	const { description } = useCourseAverages(item.courseId);
	const ready = difficulty > 0 && usefulness > 0;

	return (
		<section className="flex flex-col gap-6" aria-labelledby="rate-course-title">
			<header className="space-y-2">
				<p className="flex items-center gap-2 text-sm text-muted-foreground">
					<FacultyDot name={item.facultyName} />
					{item.facultyName}
					<span aria-hidden="true">/</span>
					{item.semesterLabel}
				</p>
				<h2
					id="rate-course-title"
					className="text-2xl font-semibold leading-tight text-balance"
				>
					{item.title}
				</h2>
				{description ? (
					<p className="line-clamp-2 text-sm text-muted-foreground">
						{description}
					</p>
				) : null}
			</header>

			<OthersScores item={item} mine={ready ? { difficulty, usefulness } : undefined} />

			<div className="space-y-5 rounded-xl border p-5">
				<ScoreInput
					label={
						<span id="split-difficulty" className="font-medium">
							Складність
						</span>
					}
					labelId="split-difficulty"
					value={difficulty}
					onChange={setDifficulty}
					descriptions={difficultyDescriptions}
				/>
				<ScoreInput
					label={
						<span id="split-usefulness" className="font-medium">
							Корисність
						</span>
					}
					labelId="split-usefulness"
					value={usefulness}
					onChange={setUsefulness}
					descriptions={usefulnessDescriptions}
				/>
				<Textarea
					value={comment}
					onChange={(event) => setComment(event.target.value)}
					placeholder="Кілька слів для тих, хто обиратиме (необовʼязково)"
					rows={3}
				/>
				<label className="flex items-center gap-2 text-sm">
					<Checkbox
						checked={anonymous}
						onCheckedChange={(next) => setAnonymous(next === true)}
					/>
					Анонімно
				</label>
			</div>

			<div className="flex items-center justify-between gap-3">
				<Button
					variant="ghost"
					onClick={() => {
						queue.skip(item);
						onDone();
					}}
				>
					Пропустити
				</Button>
				<Button
					disabled={!ready || queue.isSaving}
					onClick={async () => {
						await queue.save(
							item,
							{ difficulty, usefulness },
							{ comment, isAnonymous: anonymous },
						);
						onDone();
					}}
				>
					Зберегти і далі
					<ChevronRight aria-hidden="true" />
				</Button>
			</div>
		</section>
	);
}

/** Variant A: the queue on the left, the current course and its form on the right. */
export function SplitVariant({ queue }: Readonly<{ queue: RateQueue }>) {
	const [current, setCurrent] = useState<QueueItem | null>(
		() => queue.nextTodo() ?? null,
	);
	const [showList, setShowList] = useState(false);
	const active = current ?? queue.nextTodo();
	const total = queue.items.length;

	return (
		<div className="grid gap-6 md:grid-cols-[300px_1fr] md:gap-10">
			<aside className="md:sticky md:top-24 md:self-start">
				<div className="space-y-2 pb-4">
					<div className="flex items-baseline justify-between">
						<p className="text-sm font-medium">
							Оцінено {queue.doneCount} з {total}
						</p>
						<button
							type="button"
							className="text-sm text-primary md:hidden"
							onClick={() => setShowList((open) => !open)}
						>
							{showList ? "Сховати список" : "Усі курси"}
						</button>
					</div>
					<ProgressBar done={queue.doneCount} total={total} />
				</div>
				<div className={cn("max-md:hidden", showList && "max-md:block")}>
					<QueueList
						queue={queue}
						current={active}
						onPick={(item) => {
							setCurrent(item);
							setShowList(false);
						}}
					/>
				</div>
			</aside>
			{active ? (
				<CoursePanel
					key={active.offeringId}
					item={active}
					queue={queue}
					onDone={() => setCurrent(queue.nextTodo(active))}
				/>
			) : (
				<div className="flex flex-col items-start gap-3 py-10">
					<CornerDownRight className="size-6 text-primary" aria-hidden="true" />
					<p className="text-xl font-semibold">Усе оцінено, дякуємо!</p>
				</div>
			)}
		</div>
	);
}

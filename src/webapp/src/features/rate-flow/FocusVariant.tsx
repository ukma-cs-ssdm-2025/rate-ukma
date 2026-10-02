import { useState } from "react";

import { ArrowRight, PenLine } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";
import { FacultyDot, OthersScores } from "./CourseContext";
import type { QueueItem, RateQueue } from "./useRateQueue";

function Scale({
	name,
	low,
	high,
	value,
	onChange,
}: Readonly<{
	name: string;
	low: string;
	high: string;
	value: number;
	onChange: (value: number) => void;
}>) {
	const id = `focus-${name}`;
	return (
		<div className="space-y-2">
			<p id={id} className="font-medium">
				{name}
			</p>
			<div role="radiogroup" aria-labelledby={id} className="grid grid-cols-5 gap-2">
				{[1, 2, 3, 4, 5].map((score) => (
					<button
						key={score}
						type="button"
						role="radio"
						aria-checked={value === score}
						onClick={() => onChange(score)}
						className={cn(
							"h-14 rounded-xl border text-lg font-semibold tabular-nums transition-colors hover:border-primary/60",
							value === score &&
								"border-primary bg-primary text-primary-foreground hover:border-primary",
							value > 0 && value !== score && "text-muted-foreground",
						)}
					>
						{score}
					</button>
				))}
			</div>
			<div className="flex justify-between text-xs text-muted-foreground">
				<span>{low}</span>
				<span>{high}</span>
			</div>
		</div>
	);
}

function FocusCard({
	item,
	queue,
	onDone,
}: Readonly<{ item: QueueItem; queue: RateQueue; onDone: () => void }>) {
	const [difficulty, setDifficulty] = useState(0);
	const [usefulness, setUsefulness] = useState(0);
	const [writing, setWriting] = useState(false);
	const [comment, setComment] = useState("");
	const ready = difficulty > 0 && usefulness > 0;

	return (
		<article className="space-y-7 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
			<header className="space-y-2">
				<p className="flex items-center gap-2 text-sm text-muted-foreground">
					<FacultyDot name={item.facultyName} />
					{item.semesterLabel}
				</p>
				<h2 className="text-2xl font-semibold leading-tight text-balance sm:text-3xl">
					{item.title}
				</h2>
			</header>

			<Scale
				name="Складність"
				low="Легко"
				high="Дуже складно"
				value={difficulty}
				onChange={setDifficulty}
			/>
			<Scale
				name="Корисність"
				low="Не знадобилось"
				high="Дуже корисно"
				value={usefulness}
				onChange={setUsefulness}
			/>

			<div className="border-t pt-5">
				<OthersScores
					item={item}
					hidden={!ready}
					mine={ready ? { difficulty, usefulness } : undefined}
				/>
			</div>

			{writing ? (
				<Textarea
					autoFocus
					value={comment}
					onChange={(event) => setComment(event.target.value)}
					placeholder="Що варто знати тим, хто обиратиме?"
					rows={3}
				/>
			) : null}

			<div className="flex flex-wrap items-center justify-between gap-3">
				{writing ? (
					<span />
				) : (
					<Button variant="outline" onClick={() => setWriting(true)}>
						<PenLine aria-hidden="true" />
						Додати відгук
					</Button>
				)}
				<Button
					size="lg"
					disabled={!ready || queue.isSaving}
					onClick={async () => {
						await queue.save(item, { difficulty, usefulness }, { comment });
						onDone();
					}}
				>
					Далі
					<ArrowRight aria-hidden="true" />
				</Button>
			</div>
		</article>
	);
}

/** Variant B: one course at a time, big tap targets, others' scores revealed after yours. */
export function FocusVariant({ queue }: Readonly<{ queue: RateQueue }>) {
	const [current, setCurrent] = useState<QueueItem | null>(
		() => queue.nextTodo() ?? null,
	);
	const total = queue.items.length;
	const position = current ? queue.items.indexOf(current) + 1 : total;

	return (
		<div className="mx-auto max-w-xl space-y-5">
			<div className="space-y-2">
				<div className="flex items-center justify-between text-sm">
					<span className="font-medium tabular-nums">
						Курс {position} з {total}
					</span>
					{current ? (
						<button
							type="button"
							className="text-muted-foreground hover:text-foreground"
							onClick={() => {
								queue.skip(current);
								setCurrent(queue.nextTodo(current));
							}}
						>
							Пропустити
						</button>
					) : null}
				</div>
				<div className="flex gap-1" aria-hidden="true">
					{queue.items.map((item) => {
						const state = queue.stateOf(item);
						return (
							<span
								key={item.offeringId}
								className={cn(
									"h-1.5 flex-1 rounded-full bg-muted",
									state.kind === "done" && "bg-primary",
									state.kind === "skipped" && "bg-muted-foreground/40",
									item === current && "bg-primary/40",
								)}
							/>
						);
					})}
				</div>
			</div>
			{current ? (
				<FocusCard
					key={current.offeringId}
					item={current}
					queue={queue}
					onDone={() => setCurrent(queue.nextTodo(current))}
				/>
			) : (
				<p className="py-10 text-center text-xl font-semibold">
					Усе оцінено, дякуємо!
				</p>
			)}
		</div>
	);
}

import { useEffect, useRef } from "react";

import { ArrowRight, PartyPopper } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { coursesNoun, pluralUk } from "./plural";
import { StatusRing } from "./RateQueueRail";
import type { RateQueue, SemesterBucket } from "./useRateQueue";

/** One line that changes as the queue shrinks, so each stop reads new. */
function encouragement(rated: number, total: number, semestersLeft: number) {
	if (semestersLeft === 1) return "Залишився останній семестр.";
	if (rated * 2 >= total) return "Більше половини вже позаду.";
	return `Попереду ще ${semestersLeft} ${pluralUk(semestersLeft, ["семестр", "семестри", "семестрів"])}.`;
}

interface RateSemesterDoneProps {
	readonly queue: RateQueue;
	readonly semester: SemesterBucket;
	readonly onContinue: () => void;
	readonly onBreak: () => void;
}

/**
 * Between semesters: the one just finished, every ring closed, and what is
 * left. A pause that thanks the student and makes the next step the easy one.
 */
export function RateSemesterDone({
	queue,
	semester,
	onContinue,
	onBreak,
}: Readonly<RateSemesterDoneProps>) {
	const ratedHere = semester.items.filter(
		(item) => queue.stateOf(item).kind === "done",
	).length;
	const ahead = queue.semesters.filter((bucket) =>
		bucket.items.some((item) => queue.stateOf(item).kind === "todo"),
	);
	const next = ahead[0];
	const nextCount = next
		? next.items.filter((item) => queue.stateOf(item).kind === "todo").length
		: 0;

	// A new screen in place of the form: move focus so it is read out.
	const headRef = useRef<HTMLDivElement>(null);
	useEffect(() => headRef.current?.focus({ preventScroll: true }), []);

	return (
		<section aria-label="Семестр позаду" className="space-y-8">
			<div ref={headRef} tabIndex={-1} className="space-y-4 outline-none">
				<span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
					<PartyPopper aria-hidden="true" className="size-6" />
				</span>
				<PageHeader
					title={`${semester.label} позаду`}
					description={`Дякуємо! ${ratedHere} ${pluralUk(ratedHere, ["ваша оцінка", "ваші оцінки", "ваших оцінок"])} вже допомагають іншим обирати дисципліни.`}
				/>
			</div>

			{/* Phones only: on desktop the rail beside it already shows these rings. */}
			<ul className="space-y-2 rounded-xl bg-muted/50 px-4 py-3 lg:hidden">
				{semester.items.map((item) => {
					const state = queue.stateOf(item);
					return (
						<li
							key={item.offeringId}
							className="flex items-start gap-3 text-sm"
						>
							<StatusRing state={state} share={0} />
							<span className="min-w-0 flex-1">
								<span className="line-clamp-2">{item.title}</span>
								{state.kind === "skipped" ? (
									<span className="block text-xs text-muted-foreground">
										Пропущено
									</span>
								) : null}
							</span>
						</li>
					);
				})}
			</ul>

			{next ? (
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="min-w-0 space-y-0.5">
						<p className="font-medium">
							{`Далі ${next.label}, ${nextCount} ${coursesNoun(nextCount)}`}
						</p>
						<p className="text-sm text-muted-foreground">
							{encouragement(queue.doneCount, queue.items.length, ahead.length)}
						</p>
					</div>
					<div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
						<Button variant="ghost" onClick={onBreak}>
							Зробити перерву
						</Button>
						<Button size="lg" onClick={onContinue}>
							Продовжити
							<ArrowRight aria-hidden="true" />
						</Button>
					</div>
				</div>
			) : null}
		</section>
	);
}

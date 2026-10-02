import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { RatingStats } from "@/features/ratings/components/RatingStats";
import type { QueueItem, RateQueue, Scores } from "./useRateQueue";
import { coursesNoun } from "./plural";
import { useCourseTerm } from "@/lib/course-term";

interface RateSummaryProps {
	readonly queue: RateQueue;
	/** Puts the skipped courses back in the queue and opens the first. */
	readonly onReturnToSkipped: () => void;
}

/**
 * The end of the queue: what the student rated, in the same score format as
 * «Мої оцінки», and a way back to anything they skipped.
 */
export function RateSummary({
	queue,
	onReturnToSkipped,
}: Readonly<RateSummaryProps>) {
	const term = useCourseTerm();
	const done = queue.items.flatMap((item) => {
		const state = queue.stateOf(item);
		return state.kind === "done" ? [{ item, scores: state.scores }] : [];
	});
	const skipped = queue.items.filter(
		(item) => queue.stateOf(item).kind === "skipped",
	).length;
	const rated = done.length;

	const title =
		rated > 0
			? `Дякуємо, ви оцінили ${rated} ${coursesNoun(rated, term)}`
			: term("Курси пропущено", "Дисципліни пропущено");
	const description =
		rated > 0
			? term(
					"Ваші оцінки вже бачать студенти, які обирають ці курси",
					"Ваші оцінки вже бачать студенти, які обирають ці дисципліни",
				)
			: "Вони чекатимуть у «Моїх оцінках», поки ви не повернетеся";

	return (
		<section aria-label="Підсумок" className="space-y-8">
			<PageHeader title={title} description={description} />

			{rated > 0 ? (
				// The rows of «Мої оцінки», so the result reads as the place it lands.
				<ul className="space-y-2">
					{done.map(({ item, scores }) => (
						<SummaryRow key={item.offeringId} item={item} scores={scores} />
					))}
				</ul>
			) : null}

			{skipped > 0 ? (
				<div className="flex flex-col gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
					<div className="min-w-0 space-y-0.5">
						<p className="font-medium">
							Пропущено {skipped} {coursesNoun(skipped, term)}
						</p>
						<p className="text-sm text-muted-foreground">
							Можна оцінити зараз або пізніше в «Моїх оцінках»
						</p>
					</div>
					<Button variant="outline" onClick={onReturnToSkipped}>
						Повернутися до пропущених
					</Button>
				</div>
			) : null}

			<div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
				<Button variant="ghost" asChild>
					<Link to="/">{term("До курсів", "До дисциплін")}</Link>
				</Button>
				<Button size="lg" asChild>
					<Link to="/my-ratings">
						До моїх оцінок
						<ArrowRight aria-hidden="true" />
					</Link>
				</Button>
			</div>
		</section>
	);
}

function SummaryRow({
	item,
	scores,
}: Readonly<{ item: QueueItem; scores: Scores }>) {
	return (
		<li className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-muted/50 px-4 py-3">
			<div className="min-w-0 flex-1 basis-40 space-y-0.5">
				<Link
					to="/courses/$courseId"
					params={{ courseId: item.courseId }}
					className="line-clamp-2 font-medium underline-offset-4 hover:text-primary hover:underline"
				>
					{item.title}
				</Link>
				<p className="text-sm text-muted-foreground">{item.semesterLabel}</p>
			</div>
			<div className="sm:ml-auto">
				<RatingStats
					difficulty={scores.difficulty}
					usefulness={scores.usefulness}
				/>
			</div>
		</li>
	);
}

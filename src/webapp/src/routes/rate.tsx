import { useState } from "react";

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, PartyPopper } from "lucide-react";

import Layout from "@/components/Layout";
import { Button } from "@/components/ui/Button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import { RateCoursePane } from "@/features/rate-flow/RateCoursePane";
import {
	RateQueueBar,
	RateQueueRail,
} from "@/features/rate-flow/RateQueueRail";
import {
	type QueueItem,
	useRateQueue,
} from "@/features/rate-flow/useRateQueue";
import { MyRatingsNotStudentState } from "@/features/ratings/components/MyRatingsNotStudentState";
import { useAuth, withAuth } from "@/lib/auth";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

function BackLink() {
	return (
		<Link
			to="/my-ratings"
			className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
		>
			<ArrowLeft className="size-4" aria-hidden="true" />
			Мої оцінки
		</Link>
	);
}

function AllDone({
	rated,
	skipped,
}: Readonly<{ rated: number; skipped: number }>) {
	return (
		<Empty className="border-0 py-16">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<PartyPopper />
				</EmptyMedia>
				<EmptyTitle>
					{rated > 0 ? `Готово, оцінено ${rated}` : "Немає курсів для оцінки"}
				</EmptyTitle>
				<EmptyDescription>
					{skipped > 0
						? "Пропущені курси чекатимуть у «Моїх оцінках»"
						: "Дякуємо! Ваші оцінки допоможуть іншим обрати"}
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild>
					<Link to="/my-ratings">До моїх оцінок</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}

function RatePage() {
	const { isStudent } = useAuth();
	const isDesktop = useMediaQuery("(min-width: 1024px)");
	const queue = useRateQueue();
	const [picked, setPicked] = useState<QueueItem | null>(null);
	const [finished, setFinished] = useState(false);
	const [anonymous, setAnonymous] = useState(false);
	const [listOpen, setListOpen] = useState(false);

	if (!isStudent) {
		return (
			<Layout>
				<MyRatingsNotStudentState />
			</Layout>
		);
	}

	const current = finished ? null : (picked ?? queue.nextTodo());
	const pick = (item: QueueItem) => {
		setFinished(false);
		setPicked(item);
	};
	const goNext = () => {
		const next = current ? queue.nextTodo(current) : null;
		setPicked(next);
		if (!next) setFinished(true);
	};
	const skipped = queue.items.filter(
		(item) => queue.stateOf(item).kind === "skipped",
	).length;

	let body: React.ReactNode;
	if (queue.isLoading) {
		body = <Skeleton className="h-[480px] w-full rounded-xl" />;
	} else if (!current) {
		body = <AllDone rated={queue.doneCount} skipped={skipped} />;
	} else {
		const state = queue.stateOf(current);
		body = (
			<RateCoursePane
				key={current.offeringId}
				item={current}
				savedScores={state.kind === "done" ? state.scores : undefined}
				anonymous={anonymous}
				hasNext={queue.nextTodo(current) !== null}
				onSaved={(scores, isAnonymous) => {
					// Pin the course so the result stays up until «Наступний курс».
					setPicked(current);
					queue.markDone(current, scores);
					setAnonymous(isAnonymous);
				}}
				onSkip={() => {
					queue.skip(current);
					goNext();
				}}
				onNext={goNext}
			/>
		);
	}

	const hasQueue = queue.items.length > 0;

	return (
		<Layout>
			<div className="space-y-6 pb-16">
				<BackLink />
				{hasQueue && !isDesktop ? (
					<RateQueueBar
						queue={queue}
						current={current}
						onPick={pick}
						open={listOpen}
						onOpenChange={setListOpen}
					/>
				) : null}
				<div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_320px]">
					{body}
					{hasQueue && isDesktop ? (
						<aside className="min-w-0">
							<div className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
								<RateQueueRail queue={queue} current={current} onPick={pick} />
							</div>
						</aside>
					) : null}
				</div>
			</div>
		</Layout>
	);
}

export const Route = createFileRoute("/rate")({
	component: withAuth(RatePage),
});

import { useEffect, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { CircleCheck } from "lucide-react";
import { Helmet } from "react-helmet-async";

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
import { CourseDetailsHeaderSkeleton } from "@/features/courses/components/CourseDetailsHeader";
import { RateCoursePane } from "@/features/rate-flow/RateCoursePane";
import { RateLeaveDialog } from "@/features/rate-flow/RateLeaveDialog";
import { RateSummary } from "@/features/rate-flow/RateSummary";
import {
	RateQueueBar,
	RateQueueRail,
} from "@/features/rate-flow/RateQueueRail";
import {
	type QueueItem,
	useRateQueue,
} from "@/features/rate-flow/useRateQueue";
import { MyRatingsErrorState } from "@/features/ratings/components/MyRatingsErrorState";
import { MyRatingsNotStudentState } from "@/features/ratings/components/MyRatingsNotStudentState";
import {
	getCoursesOfferingsListQueryOptions,
	getCoursesRetrieveQueryOptions,
} from "@/lib/api/generated";
import { formatPageTitle } from "@/lib/app-metadata";
import { useAuth, withAuth } from "@/lib/auth";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

/** Opened with nothing to rate: everything is rated, or nothing is open yet. */
function AllDone() {
	return (
		<Empty className="border-0 py-16">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<CircleCheck />
				</EmptyMedia>
				<EmptyTitle>Усі курси оцінено</EmptyTitle>
				<EmptyDescription>
					Нові з'являться, коли відкриється оцінювання наступного семестру.
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

const RAIL_ROWS = ["row-1", "row-2", "row-3", "row-4", "row-5", "row-6"];

/** The page's own shape while grades load, so the rail and form land in place. */
function RatePageSkeleton({ isDesktop }: Readonly<{ isDesktop: boolean }>) {
	const pane = (
		<div className="min-w-0 space-y-8">
			<CourseDetailsHeaderSkeleton />
			<div className="space-y-6">
				<Skeleton className="h-6 w-40" />
				<Skeleton className="h-24 w-full rounded-xl" />
				<Skeleton className="h-24 w-full rounded-xl" />
			</div>
		</div>
	);
	if (!isDesktop) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-[76px] w-full rounded-xl" />
				{pane}
			</div>
		);
	}
	return (
		<div className={GRID}>
			<div className="space-y-6 px-3">
				<div className="space-y-2">
					<Skeleton className="h-7 w-40" />
					<Skeleton className="h-4 w-28" />
					<Skeleton className="h-1.5 w-full" />
				</div>
				<div className="space-y-3">
					{RAIL_ROWS.map((key) => (
						<Skeleton key={key} className="h-5 w-full" />
					))}
				</div>
			</div>
			{pane}
		</div>
	);
}

const GRID =
	"grid gap-x-10 gap-y-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-x-12";

function RatePage() {
	const { isStudent } = useAuth();
	const isDesktop = useMediaQuery("(min-width: 1024px)");
	const queue = useRateQueue();
	const [picked, setPicked] = useState<QueueItem | null>(null);
	const [finished, setFinished] = useState(false);
	const [anonymous, setAnonymous] = useState(false);
	const [listOpen, setListOpen] = useState(false);
	const [moved, setMoved] = useState(false);
	const [activeShare, setActiveShare] = useState(0);
	// Asked once per visit: a second try to leave goes straight through.
	const [askedToStay, setAskedToStay] = useState(false);
	const queryClient = useQueryClient();

	const current = finished ? null : (picked ?? queue.nextTodo());
	const pick = (item: QueueItem) => {
		setFinished(false);
		setMoved(true);
		setPicked(item);
	};
	const goNext = () => {
		const after = current ? queue.nextTodo(current) : null;
		setMoved(true);
		setPicked(after);
		if (!after) setFinished(true);
	};

	const next = current ? queue.nextTodo(current) : null;
	const remainingTodo = queue.items.filter(
		(item) => queue.stateOf(item).kind === "todo",
	).length;
	const hasDraft =
		activeShare > 0 &&
		current != null &&
		queue.stateOf(current).kind === "todo";
	// Only once the student has started: a glance at the page leaves freely.
	const shouldAsk =
		isStudent &&
		!askedToStay &&
		!finished &&
		remainingTodo > 0 &&
		(queue.doneCount > 0 || hasDraft);
	const blocker = useBlocker({
		// «Відгуки про курс» is a look the student asked for, not leaving.
		shouldBlockFn: ({ next: to }) =>
			shouldAsk && !to.pathname.startsWith("/courses/"),
		enableBeforeUnload: () => hasDraft,
		withResolver: true,
	});
	useEffect(() => {
		// The next course is one click away: have it ready so its header and
		// form open without a loading frame.
		if (!next) return;
		void queryClient.prefetchQuery(
			getCoursesRetrieveQueryOptions(next.courseId),
		);
		void queryClient.prefetchQuery(
			getCoursesOfferingsListQueryOptions(next.courseId),
		);
	}, [next?.courseId, queryClient]);

	const title = (
		<Helmet>
			<title>{formatPageTitle("Оцінити курси")}</title>
		</Helmet>
	);

	if (!isStudent) {
		return (
			<Layout>
				{title}
				<MyRatingsNotStudentState />
			</Layout>
		);
	}

	if (queue.isLoading) {
		return (
			<Layout>
				{title}
				<div className="pb-16">
					<RatePageSkeleton isDesktop={isDesktop} />
				</div>
			</Layout>
		);
	}

	if (queue.isError) {
		return (
			<Layout>
				{title}
				<MyRatingsErrorState
					onRetry={() => void queue.refetch()}
					isRetrying={queue.isRefetching}
				/>
			</Layout>
		);
	}

	let body: React.ReactNode;
	if (!current && queue.items.length > 0) {
		body = (
			<RateSummary
				queue={queue}
				onReturnToSkipped={() => {
					const first = queue.items.find(
						(item) => queue.stateOf(item).kind === "skipped",
					);
					queue.unskipAll();
					setFinished(false);
					setMoved(true);
					setPicked(first ?? null);
				}}
			/>
		);
	} else if (!current) {
		body = <AllDone />;
	} else {
		const state = queue.stateOf(current);
		body = (
			<RateCoursePane
				key={current.offeringId}
				item={current}
				savedScores={state.kind === "done" ? state.scores : undefined}
				anonymous={anonymous}
				remaining={
					queue.items.filter(
						(item) => item !== current && queue.stateOf(item).kind === "todo",
					).length
				}
				focusOnMount={moved}
				onProgressChange={setActiveShare}
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

	// One course needs no list beside it.
	const showQueue = queue.items.length > 1;

	const leaveDialog = (
		<RateLeaveDialog
			open={blocker.status === "blocked"}
			rated={queue.doneCount}
			total={queue.items.length}
			remaining={remainingTodo}
			hasDraft={hasDraft}
			onStay={() => {
				setAskedToStay(true);
				blocker.reset?.();
			}}
			onLeave={() => blocker.proceed?.()}
		/>
	);

	return (
		<Layout>
			{title}
			{leaveDialog}
			<div className="space-y-6 pb-16">
				{showQueue && !isDesktop ? (
					<RateQueueBar
						queue={queue}
						current={current}
						activeShare={activeShare}
						onPick={pick}
						open={listOpen}
						onOpenChange={setListOpen}
					/>
				) : null}
				<div className={showQueue ? GRID : undefined}>
					{showQueue && isDesktop ? (
						<aside className="min-w-0">
							<div className="lg:sticky lg:top-24 lg:-ml-3 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
								<RateQueueRail
									queue={queue}
									current={current}
									activeShare={activeShare}
									onPick={pick}
								/>
							</div>
						</aside>
					) : null}
					{/* The form's line length, like the rating modal; the page keeps the app's edges. */}
					<div className="min-w-0 max-w-3xl lg:col-start-2">{body}</div>
				</div>
			</div>
		</Layout>
	);
}

export const Route = createFileRoute("/rate")({
	component: withAuth(RatePage),
});

import { useEffect, useRef, useState } from "react";

import {
	getLatestOffering,
	getLatestOfferingTerms,
} from "@/features/course-offerings/components/CourseCazRecords";
import { offeringLoad } from "@/features/course-offerings/components/CourseAbout";
import { Skeleton } from "@/components/ui/Skeleton";
import { CourseDetailsHeader } from "@/features/courses/components/CourseDetailsHeader";
import {
	RatingForm,
	type RatingFormData,
} from "@/features/ratings/components/RatingForm";
import {
	useRatingAuthor,
	useRatingSubmit,
} from "@/features/ratings/hooks/useRatingSubmit";
import {
	useCoursesOfferingsList,
	useCoursesRetrieve,
} from "@/lib/api/generated";
import { RateComparison } from "./RateComparison";
import type { QueueItem, Scores } from "./useRateQueue";

function FormHeading({
	title,
	description,
}: Readonly<{ title: string; description: string }>) {
	// Mirrors the rating modal's header, so the form reads as the same dialog.
	return (
		<div className="space-y-1.5">
			<h2 id="rate-form-title" className="text-lg font-semibold tracking-tight">
				{title}
			</h2>
			<p className="text-sm text-muted-foreground">{description}</p>
		</div>
	);
}

interface RateCoursePaneProps {
	readonly item: QueueItem;
	/** Scores already saved in this session; the pane opens on the result. */
	readonly savedScores?: Scores;
	/** Carried over from the previous course, so anonymity is picked once. */
	readonly anonymous: boolean;
	/** Courses still waiting after this one. */
	readonly remaining: number;
	/** Opened by moving through the queue: start at the top, focus on the course. */
	readonly focusOnMount?: boolean;
	/** Share of the form answered so far, for the course's ring in the list. */
	readonly onProgressChange?: (share: number) => void;
	readonly onSaved: (scores: Scores, anonymous: boolean) => void;
	readonly onSkip: () => void;
	readonly onNext: () => void;
}

/**
 * One course of the queue, laid out like its course page: the header, then
 * the rating modal's own form where the scores would be.
 * Others' scores stay hidden until the student has rated, so the average
 * cannot pull their answer towards it; then the form turns into a comparison.
 */
export function RateCoursePane({
	item,
	savedScores,
	anonymous,
	remaining,
	focusOnMount = false,
	onProgressChange,
	onSaved,
	onSkip,
	onNext,
}: Readonly<RateCoursePaneProps>) {
	const { data: course, isLoading: isCourseLoading } = useCoursesRetrieve(
		item.courseId,
	);
	const { data: offeringsData } = useCoursesOfferingsList(item.courseId);
	const author = useRatingAuthor();
	const { submit, isLoading } = useRatingSubmit({
		courseId: item.courseId,
		offeringId: item.offeringId,
		toastOnSuccess: false,
	});
	const [saved, setSaved] = useState<Scores | null>(savedScores ?? null);
	const nextRef = useRef<HTMLButtonElement>(null);
	const headRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!focusOnMount) return;
		// The previous course's button is gone: without this the keyboard lands
		// on the page body and the new course opens wherever the result was.
		globalThis.scrollTo({ top: 0 });
		headRef.current?.focus({ preventScroll: true });
	}, [focusOnMount]);

	// Same shape the modal passes when editing: an empty verdict, the student's
	// last anonymity choice.
	const [initialData] = useState<RatingFormData>(() => ({
		difficulty: 0,
		usefulness: 0,
		comment: "",
		instructor_ids: [],
		instructor: "",
		is_anonymous: anonymous,
	}));

	useEffect(() => {
		if (!saved || savedScores) return;
		// The verdict replaces a long form: bring it to the top, keep the
		// keyboard on «Наступний курс».
		globalThis.document
			.getElementById("rate-result")
			?.scrollIntoView({ block: "center" });
		nextRef.current?.focus({ preventScroll: true });
	}, [saved, savedScores]);

	const offerings = offeringsData?.course_offerings ?? [];
	const latestOffering = getLatestOffering(offerings);
	const load = offeringLoad(latestOffering);

	return (
		<div className="min-w-0 space-y-8">
			<div ref={headRef} tabIndex={-1} className="outline-none">
				{isCourseLoading ? (
					// The queue already knows the title and faculty: show them at once
					// and hold only the chips' line, so nothing moves when the course lands.
					<header className="min-w-0 space-y-3">
						<h1 className="max-w-4xl text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
							{item.title}
						</h1>
						<p className="text-sm text-muted-foreground">{item.facultyName}</p>
						<div className="flex gap-1.5" aria-hidden="true">
							<Skeleton className="h-5 w-9 rounded-full" />
							<Skeleton className="h-5 w-14 rounded-full" />
							<Skeleton className="h-5 w-24 rounded-full" />
						</div>
					</header>
				) : (
					<CourseDetailsHeader
						title={course?.title ?? item.title}
						educationLevel={course?.education_level}
						specialities={course?.specialities ?? []}
						departmentName={course?.department_name ?? ""}
						facultyName={course?.faculty_name ?? item.facultyName}
						terms={getLatestOfferingTerms(offerings)}
						credits={load.credits}
						weeklyHours={load.weeklyHours}
					/>
				)}
			</div>

			{saved ? (
				<RateComparison
					courseId={item.courseId}
					scores={saved}
					remaining={remaining}
					onNext={onNext}
					nextRef={nextRef}
				/>
			) : (
				<section aria-labelledby="rate-form-title" className="space-y-1">
					<FormHeading
						title="Ваша оцінка"
						description="Після збереження порівняєте її з оцінками інших"
					/>
					<RatingForm
						onSubmit={async (data) => {
							if (!(await submit(data))) return;
							const scores = {
								difficulty: data.difficulty,
								usefulness: data.usefulness,
							};
							setSaved(scores);
							onSaved(scores, data.is_anonymous);
						}}
						onCancel={onSkip}
						isLoading={isLoading}
						initialData={initialData}
						offeringId={item.offeringId}
						courseId={item.courseId}
						author={author}
						submitLabel="Зберегти"
						cancelLabel="Пропустити"
						inline
						onProgressChange={onProgressChange}
					/>
				</section>
			)}
		</div>
	);
}

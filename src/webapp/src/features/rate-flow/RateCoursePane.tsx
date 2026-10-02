import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/Card";
import {
	getLatestOffering,
	getLatestOfferingTerms,
} from "@/features/course-offerings/components/CourseCazRecords";
import {
	CourseAbout,
	CourseAboutSkeleton,
	offeringLoad,
} from "@/features/course-offerings/components/CourseAbout";
import {
	CourseDetailsHeader,
	CourseDetailsHeaderSkeleton,
} from "@/features/courses/components/CourseDetailsHeader";
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

function CardHeading({
	title,
	description,
}: Readonly<{ title: string; description: string }>) {
	// Mirrors the rating modal's header, so the form reads as the same dialog.
	return (
		<div className="space-y-1.5 px-6 pt-6 pb-1">
			<h2 className="text-lg font-semibold leading-snug">{title}</h2>
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
	readonly hasNext: boolean;
	readonly onSaved: (scores: Scores, anonymous: boolean) => void;
	readonly onSkip: () => void;
	readonly onNext: () => void;
}

/**
 * One course of the queue, laid out like its course page: the header, the
 * rating modal's own form where the scores would be, and «Про курс» beside it.
 * Others' scores stay hidden until the student has rated, so the average
 * cannot pull their answer towards it; then the form turns into a comparison.
 */
export function RateCoursePane({
	item,
	savedScores,
	anonymous,
	hasNext,
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
		if (saved && !savedScores) nextRef.current?.focus();
	}, [saved, savedScores]);

	const offerings = offeringsData?.course_offerings ?? [];
	const latestOffering = getLatestOffering(offerings);
	const load = offeringLoad(latestOffering);

	return (
		<div className="grid min-w-0 gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,1fr)_300px]">
			<div className="min-w-0 space-y-8">
				<div className="space-y-3">
					<p className="text-sm text-muted-foreground">
						Ви слухали цей курс у семестрі «{item.semesterLabel}»
					</p>
					{isCourseLoading ? (
						<CourseDetailsHeaderSkeleton />
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
						hasNext={hasNext}
						onNext={onNext}
						nextRef={nextRef}
					/>
				) : (
					<Card className="shadow-sm">
						<CardHeading
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
						/>
					</Card>
				)}
			</div>

			<aside className="min-w-0">
				{/* The course page's own rail: the description and history jog the
				    memory of a course taken months ago. */}
				{offeringsData && !isCourseLoading ? (
					<CourseAbout
						description={course?.description}
						latestOffering={latestOffering}
						courseOfferings={offerings}
					/>
				) : (
					<CourseAboutSkeleton />
				)}
			</aside>
		</div>
	);
}

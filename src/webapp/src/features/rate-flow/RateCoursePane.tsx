import { useEffect, useRef, useState } from "react";

import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
	getLatestOffering,
	getLatestOfferingTerms,
} from "@/features/course-offerings/components/CourseCazRecords";
import { offeringLoad } from "@/features/course-offerings/components/CourseAbout";
import {
	CourseDetailsHeader,
	CourseDetailsHeaderSkeleton,
} from "@/features/courses/components/CourseDetailsHeader";
import {
	CourseStatsHero,
	CourseStatsHeroSkeleton,
} from "@/features/courses/components/CourseStatsCards";
import {
	getDifficultyTone,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
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

function MyScores({ scores }: Readonly<{ scores: Scores }>) {
	return (
		<p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
			<span>Ваша оцінка</span>
			<span>
				Складність{" "}
				<span
					className={`font-semibold tabular-nums ${getDifficultyTone(scores.difficulty)}`}
				>
					{scores.difficulty}
				</span>
			</span>
			<span>
				Корисність{" "}
				<span
					className={`font-semibold tabular-nums ${getUsefulnessTone(scores.usefulness)}`}
				>
					{scores.usefulness}
				</span>
			</span>
		</p>
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
 * One course of the queue: the course page's own header, the rating modal's
 * own form, and, once saved, the course's scores. They stay hidden until the
 * student has rated, so the average cannot pull their answer towards it.
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
	const load = offeringLoad(getLatestOffering(offerings));
	const othersCount = Math.max(0, (course?.ratings_count ?? 1) - 1);

	return (
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

			<Card className="max-w-2xl shadow-sm">
				{saved ? (
					<div className="space-y-5 p-6">
						<div className="space-y-1.5">
							<h2 className="text-lg font-semibold leading-snug">
								{othersCount > 0
									? "Дякуємо! Ось як оцінили інші"
									: "Дякуємо! Ви оцінили цей курс першими"}
							</h2>
							<MyScores scores={saved} />
						</div>
						{othersCount > 0 ? (
							course ? (
								<CourseStatsHero
									difficulty={course.avg_difficulty ?? null}
									usefulness={course.avg_usefulness ?? null}
									ratingsCount={course.ratings_count ?? null}
								/>
							) : (
								<CourseStatsHeroSkeleton />
							)
						) : null}
						<div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
							<Button variant="ghost" asChild className="w-full sm:w-auto">
								<Link
									to="/courses/$courseId"
									params={{ courseId: item.courseId }}
								>
									Відгуки про курс
								</Link>
							</Button>
							<Button
								ref={nextRef}
								size="lg"
								onClick={onNext}
								className="w-full sm:w-auto"
							>
								{hasNext ? "Наступний курс" : "Завершити"}
								<ArrowRight aria-hidden="true" />
							</Button>
						</div>
					</div>
				) : (
					<>
						<CardHeading
							title="Ваша оцінка"
							description="Після збереження побачите, як курс оцінили інші"
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
					</>
				)}
			</Card>
		</div>
	);
}

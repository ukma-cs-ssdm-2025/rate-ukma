import { useEffect, useState, type PropsWithChildren } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { Dialog, DialogContent } from "@/components/ui/Dialog";
import {
	RatingContinuationContext,
	type SavedRating,
	type FollowUpRating,
} from "../RatingContinuationContext";
import { refreshRatingQueries } from "../refreshRatingQueries";
import { useRatingFlowEnabled } from "../hooks/useRatingFlowEnabled";
import { useRatingSuggestions } from "../hooks/useRatingSuggestions";
import { toast } from "@/components/ui/Toaster";
import {
	useCoursesRetrieve,
	useStudentsMeGradesRetrieve,
	type StudentRatingsDetailed,
} from "@/lib/api/generated";
import { RatingSaved } from "./RatingSaved";
import type { SemesterStoryData } from "./SemesterStory";

interface Completion extends SavedRating {
	readonly pathname: string;
}

export function RatingContinuationProvider({ children }: PropsWithChildren) {
	const navigate = useNavigate();
	const pathname = useLocation({ select: (location) => location.pathname });
	const queryClient = useQueryClient();
	const [completion, setCompletion] = useState<Completion | null>(null);
	const [visible, setVisible] = useState(false);
	const [followUp, setFollowUp] = useState<FollowUpRating | null>(null);
	const flowEnabled = useRatingFlowEnabled();
	const suggestions = useRatingSuggestions(completion?.courseId, !!completion);
	const course = useCoursesRetrieve(completion?.courseId ?? "", {
		query: { enabled: !!completion },
	});
	const grades = useStudentsMeGradesRetrieve({
		query: { enabled: !!completion },
	});
	const story = completion
		? semesterStory(grades.data, completion.courseId)
		: null;

	useEffect(() => {
		if (!completion) return;
		if (!flowEnabled || completion.pathname !== pathname) {
			// The rating is saved either way; only the invitation is dropped.
			void refreshRatingQueries(queryClient, completion.courseId);
			setCompletion(null);
			setVisible(false);
			return;
		}
		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		void refreshRatingQueries(queryClient, completion.courseId).then(() => {
			if (cancelled) return;
			timer = setTimeout(() => {
				// Do not interrupt another action started during the pause.
				if (!document.querySelector('[role="dialog"], [role="alertdialog"]'))
					setVisible(true);
			}, 500);
		});
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [completion, flowEnabled, pathname, queryClient]);

	useEffect(() => {
		if (
			followUp &&
			(!flowEnabled || pathname !== `/courses/${followUp.course_id}`)
		)
			setFollowUp(null);
	}, [followUp, flowEnabled, pathname]);

	const close = () => {
		setVisible(false);
		setCompletion(null);
	};

	return (
		<RatingContinuationContext.Provider
			value={{
				complete: (rating, offerNext) => {
					setVisible(false);
					if (offerNext) {
						setCompletion({ ...rating, pathname });
					} else {
						setFollowUp(null);
						void refreshRatingQueries(queryClient, rating.courseId).then(() =>
							toast.success("Оцінку успішно додано"),
						);
					}
				},
				followUp,
				beginFollowUp: () =>
					setFollowUp((previous) =>
						previous ? { ...previous, status: "active" } : null,
					),
				cancelFollowUp: () => setFollowUp(null),
			}}
		>
			{children}
			<Dialog
				open={flowEnabled && visible && completion?.pathname === pathname}
				onOpenChange={(open) => {
					if (!open) close();
				}}
			>
				<DialogContent
					className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[500px]"
					data-testid="rating-saved-modal"
				>
					<RatingSaved
						suggestions={(suggestions.data ?? []).slice(0, story ? 1 : 2)}
						scores={
							completion
								? {
										difficulty: completion.difficulty,
										usefulness: completion.usefulness,
										avgDifficulty: course.data?.avg_difficulty,
										avgUsefulness: course.data?.avg_usefulness,
									}
								: undefined
						}
						story={story}
						isLoading={suggestions.isLoading}
						isError={suggestions.isError}
						onSelect={(item) => {
							const isAnonymous = completion?.isAnonymous ?? false;
							close();
							void navigate({
								to: "/courses/$courseId",
								params: { courseId: item.course_id },
							}).then(() =>
								setFollowUp({ ...item, isAnonymous, status: "requested" }),
							);
						}}
					/>
				</DialogContent>
			</Dialog>
		</RatingContinuationContext.Provider>
	);
}

/** The saved course's semester, once every rateable course in it has a rating. */
function semesterStory(
	data: StudentRatingsDetailed | StudentRatingsDetailed[] | undefined,
	courseId: string,
): SemesterStoryData | null {
	if (!data) return null;
	const items = Array.isArray(data) ? data : [data];
	const semester = items.find((item) => item.course_id === courseId)?.semester;
	if (!semester?.year || !semester.season) return null;
	const inSemester = items.filter(
		(item) =>
			item.semester?.year === semester.year &&
			item.semester?.season === semester.season,
	);
	if (inSemester.some((item) => item.can_rate && !item.rated)) return null;
	const ratings = inSemester.flatMap((item) =>
		item.rated?.difficulty && item.rated.usefulness
			? [
					{
						title: item.course_title ?? "",
						difficulty: item.rated.difficulty,
						usefulness: item.rated.usefulness,
					},
				]
			: [],
	);
	if (ratings.length < 2) return null;
	return { year: semester.year, season: semester.season, ratings };
}

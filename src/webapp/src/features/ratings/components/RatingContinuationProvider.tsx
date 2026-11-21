import { useEffect, useState } from "react";
import type { PropsWithChildren } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { RatingContinuationContext } from "../RatingContinuationContext";
import type { SavedRating, FollowUpRating } from "../RatingContinuationContext";
import { refreshRatingQueries } from "../refreshRatingQueries";
import { useRatingFlowEnabled } from "../hooks/useRatingFlowEnabled";
import { useRatingSuggestions } from "../hooks/useRatingSuggestions";
import { toast } from "@/components/ui/Toaster";
import { RatingSaved } from "./RatingSaved";

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

	useEffect(() => {
		if (!completion) {
			return;
		}
		if (!flowEnabled || completion.pathname !== pathname) {
			void refreshRatingQueries(queryClient, completion.courseId);
			setCompletion(null);
			setVisible(false);
			return;
		}
		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		void refreshRatingQueries(queryClient, completion.courseId).then(() => {
			if (cancelled) {
				return;
			}
			timer = setTimeout(() => {
				if (!document.querySelector('[role="dialog"], [role="alertdialog"]')) {
					setVisible(true);
				}
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
		) {
			setFollowUp(null);
		}
	}, [followUp, flowEnabled, pathname]);

	const ratedElsewhere =
		completion?.pathname.startsWith("/courses/") &&
		completion.pathname !== `/courses/${completion.courseId}`
			? completion
			: null;

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
					if (!open) {
						close();
					}
				}}
			>
				<DialogContent
					className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[500px]"
					data-testid="rating-saved-modal"
				>
					<RatingSaved
						suggestions={(suggestions.data ?? []).slice(0, 2)}
						isLoading={suggestions.isLoading}
						isError={suggestions.isError}
						onClose={close}
						openCourse={
							ratedElsewhere
								? {
										courseId: ratedElsewhere.courseId,
										name: ratedElsewhere.courseName,
										onOpen: close,
									}
								: undefined
						}
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

import { useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import {
	getCoursesRatingsListQueryKey,
	getCoursesRetrieveQueryKey,
	getStudentsMeCoursesRetrieveQueryKey,
	getStudentsMeGradesRetrieveQueryKey,
	type InlineRating,
	useCoursesRatingsCreate,
	useCoursesRatingsPartialUpdate,
} from "@/lib/api/generated";
import { DeleteRatingDialog } from "./DeleteRatingDialog";
import { RatingForm, type RatingFormData } from "./RatingForm";

type RatingWithAnonymousFlag = InlineRating & { is_anonymous?: boolean };

interface RatingModalProps {
	readonly isOpen: boolean;
	readonly onClose: () => void;
	readonly courseId: string;
	readonly offeringId: string;
	readonly courseName?: string;
	readonly existingRating?: RatingWithAnonymousFlag | null;
	readonly ratingId?: string;
	readonly onSuccess?: () => void;
}

export function RatingModal({
	isOpen,
	onClose,
	courseId,
	offeringId,
	courseName,
	existingRating,
	ratingId,
	onSuccess,
}: RatingModalProps) {
	const isEditMode = !!existingRating;
	const queryClient = useQueryClient();

	const createMutation = useCoursesRatingsCreate();
	const updateMutation = useCoursesRatingsPartialUpdate();

	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const invalidateRatingQueries = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: getStudentsMeCoursesRetrieveQueryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: getStudentsMeGradesRetrieveQueryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: getCoursesRatingsListQueryKey(courseId),
			}),
			queryClient.invalidateQueries({
				queryKey: getCoursesRetrieveQueryKey(courseId),
			}),
		]);
	};

	const handleSubmit = async (data: RatingFormData) => {
		try {
			if (isEditMode && ratingId) {
				await updateMutation.mutateAsync({
					courseId: courseId,
					ratingId: ratingId,
					data: {
						difficulty: data.difficulty,
						usefulness: data.usefulness,
						comment: data.comment || undefined,
						is_anonymous: data.is_anonymous,
					},
				});
			} else {
				await createMutation.mutateAsync({
					courseId: courseId,
					data: {
						course_offering: offeringId,
						difficulty: data.difficulty,
						usefulness: data.usefulness,
						comment: data.comment || undefined,
						is_anonymous: data.is_anonymous,
					},
				});
			}

			await invalidateRatingQueries();
			onSuccess?.();
			onClose();
		} catch (error) {
			console.error("Failed to submit rating:", error);
		}
	};

	const initialData: RatingFormData | undefined = existingRating
		? {
				difficulty: existingRating.difficulty,
				usefulness: existingRating.usefulness,
				comment: existingRating.comment || "",
				is_anonymous: existingRating.is_anonymous ?? false,
			}
		: undefined;

	const isLoading = createMutation.isPending || updateMutation.isPending;

	return (
		<>
			<Dialog open={isOpen && !showDeleteDialog} onOpenChange={onClose}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<div className="flex items-center justify-between">
							<DialogTitle>
								{isEditMode ? "Редагувати оцінку" : "Оцінити курс"}
							</DialogTitle>
						</div>
						{courseName && (
							<DialogDescription>
								{isEditMode
									? `Змініть свою оцінку для курсу ${courseName}`
									: `Поділіться своїм досвідом про курс ${courseName}`}
							</DialogDescription>
						)}
					</DialogHeader>

					<RatingForm
						onSubmit={handleSubmit}
						onCancel={onClose}
						isLoading={isLoading}
						isEditMode={isEditMode}
						initialData={initialData}
						onDelete={() => setShowDeleteDialog(true)}
					/>
				</DialogContent>
			</Dialog>

			{ratingId && (
				<DeleteRatingDialog
					courseId={courseId}
					ratingId={ratingId}
					open={showDeleteDialog}
					onOpenChange={setShowDeleteDialog}
					onSuccess={async () => {
						await invalidateRatingQueries();
						onSuccess?.();
						onClose();
					}}
					title="Видалити оцінку?"
					description="Ця дія незворотна. Вашу оцінку буде видалено назавжди."
				/>
			)}
		</>
	);
}

export type { RatingFormData } from "./RatingForm";

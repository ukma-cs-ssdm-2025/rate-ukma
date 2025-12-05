import type * as React from "react";

import { useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
	getCoursesRatingsListQueryKey,
	getCoursesRetrieveQueryKey,
	getStudentsMeCoursesRetrieveQueryKey,
	getStudentsMeGradesRetrieveQueryKey,
	useCoursesRatingsDestroy,
} from "@/lib/api/generated";

interface DeleteRatingDialogProps {
	courseId: string;
	ratingId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
	title?: string;
	description?: string;
	confirmText?: string;
	cancelText?: string;
}

export function DeleteRatingDialog({
	courseId,
	ratingId,
	open,
	onOpenChange,
	onSuccess,
	title = "Видалити оцінку?",
	description = "Ця дія незворотна. Вашу оцінку буде видалено назавжди.",
	confirmText = "Видалити",
	cancelText = "Скасувати",
}: DeleteRatingDialogProps): React.JSX.Element {
	const queryClient = useQueryClient();

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

	const deleteMutation = useCoursesRatingsDestroy({
		mutation: {
			onSuccess: async () => {
				await invalidateRatingQueries();
				onOpenChange(false);
				onSuccess?.();
			},
		},
	});

	const confirmDelete = async () => {
		try {
			await deleteMutation.mutateAsync({
				courseId,
				ratingId,
			});
		} catch (error) {
			console.error("Failed to delete rating:", error);
		}
	};

	return (
		<ConfirmDialog
			open={open}
			onOpenChange={onOpenChange}
			onConfirm={confirmDelete}
			title={title}
			description={description}
			confirmText={confirmText}
			cancelText={cancelText}
			variant="destructive"
		/>
	);
}

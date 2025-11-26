import type * as React from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useCoursesRatingsDestroy } from "@/lib/api/generated";

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
	const deleteMutation = useCoursesRatingsDestroy({
		mutation: {
			onSuccess: () => {
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

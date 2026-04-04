import { useQueryClient } from "@tanstack/react-query";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { toast } from "@/components/ui/Toaster";
import {
	getCoursesListQueryKey,
	getCoursesRatingsListQueryKey,
	getCoursesRetrieveQueryKey,
	getStudentsMeCoursesRetrieveQueryKey,
	getStudentsMeGradesRetrieveQueryKey,
	useCoursesRatingsCreate,
	useCoursesRatingsPartialUpdate,
} from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { RatingForm, type RatingFormData } from "./RatingForm";

interface ExistingRating {
	id?: string;
	difficulty?: number;
	usefulness?: number;
	comment?: string | null;
	instructor?: string | null;
	is_anonymous?: boolean;
}

interface RatingModalProps {
	readonly isOpen: boolean;
	readonly onClose: () => void;
	readonly courseId: string;
	readonly offeringId?: string;
	readonly courseName?: string;
	readonly existingRating?: ExistingRating | null;
	readonly onSuccess?: () => void;
}

export function RatingModal({
	isOpen,
	onClose,
	courseId,
	offeringId,
	courseName,
	existingRating,
	onSuccess,
}: RatingModalProps) {
	const isEditMode = !!existingRating;
	const queryClient = useQueryClient();

	const createMutation = useCoursesRatingsCreate();
	const updateMutation = useCoursesRatingsPartialUpdate();

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
			queryClient.invalidateQueries({
				queryKey: getCoursesListQueryKey(),
			}),
		]);
	};

	const handleSubmit = async (data: RatingFormData) => {
		try {
			if (isEditMode && existingRating?.id) {
				await updateMutation.mutateAsync({
					courseId: courseId,
					ratingId: existingRating.id,
					data: {
						difficulty: data.difficulty,
						usefulness: data.usefulness,
						comment: data.comment ?? "",
						instructor: data.instructor ?? "",
						is_anonymous: data.is_anonymous,
					},
				});
			} else {
				if (!offeringId) {
					toast.error(
						"Не вдалося створити оцінку: відсутній ідентифікатор курсу",
					);
					return;
				}
				await createMutation.mutateAsync({
					courseId: courseId,
					data: {
						course_offering: offeringId,
						difficulty: data.difficulty,
						usefulness: data.usefulness,
						comment: data.comment || undefined,
						instructor: data.instructor || undefined,
						is_anonymous: data.is_anonymous,
					},
				});
			}

			toast.success(
				isEditMode ? "Оцінку успішно оновлено" : "Оцінку успішно додано",
			);
			await invalidateRatingQueries();
			onSuccess?.();
			onClose();
		} catch (error) {
			console.error("Failed to submit rating:", error);
			toast.error("Не вдалося зберегти оцінку. Спробуйте ще раз");
		}
	};

	const initialData: RatingFormData | undefined = existingRating
		? {
				difficulty: existingRating.difficulty ?? 3,
				usefulness: existingRating.usefulness ?? 3,
				comment: existingRating.comment || "",
				instructor: existingRating.instructor || "",
				is_anonymous: existingRating.is_anonymous ?? false,
			}
		: undefined;

	const isLoading = createMutation.isPending || updateMutation.isPending;

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent
				className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[500px]"
				data-testid={testIds.rating.modal}
			>
				<DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4 pr-12 text-left">
					<div className="flex items-center justify-between">
						<DialogTitle data-testid={testIds.rating.modalTitle}>
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
				/>
			</DialogContent>
		</Dialog>
	);
}

export type { RatingFormData } from "./RatingForm";

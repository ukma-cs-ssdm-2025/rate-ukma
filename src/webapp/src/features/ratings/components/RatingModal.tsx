import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import {
	type InlineRating,
	useCoursesRatingsCreate,
	useCoursesRatingsPartialUpdate,
} from "@/lib/api/generated";
import { RatingForm, type RatingFormData } from "./RatingForm";

type RatingWithAnonymousFlag = InlineRating & { is_anonymous?: boolean };

interface RatingModalProps {
	isOpen: boolean;
	onClose: () => void;
	offeringId: string;
	courseName?: string;
	existingRating?: RatingWithAnonymousFlag | null;
	ratingId?: string;
	onSuccess?: () => void;
}

export function RatingModal({
	isOpen,
	onClose,
	offeringId,
	courseName,
	existingRating,
	ratingId,
	onSuccess,
}: RatingModalProps) {
	const isEditMode = !!existingRating;

	const createMutation = useCoursesRatingsCreate();
	const updateMutation = useCoursesRatingsPartialUpdate();

	const handleSubmit = async (data: RatingFormData) => {
		try {
			if (isEditMode && ratingId) {
				await updateMutation.mutateAsync({
					courseId: offeringId,
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
					courseId: offeringId,
					data: {
						course_offering: offeringId,
						difficulty: data.difficulty,
						usefulness: data.usefulness,
						comment: data.comment || undefined,
						is_anonymous: data.is_anonymous,
					},
				});
			}

			onSuccess?.();
			onClose();
			window.location.reload();
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
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>
						{isEditMode ? "Редагувати оцінку" : "Оцінити курс"}
					</DialogTitle>
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

import { useQueryClient } from "@tanstack/react-query";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { toast } from "@/components/ui/Toaster";
import type { Instructor, RatingInstructor } from "@/lib/api/generated";
import {
	getCoursesListQueryKey,
	getCoursesRatingsListQueryKey,
	getCoursesRetrieveQueryKey,
	getFeedListInfiniteQueryKey,
	getStudentsMeCoursesRetrieveQueryKey,
	getStudentsMeGradesRetrieveQueryKey,
	useCoursesRatingsCreate,
	useCoursesRatingsPartialUpdate,
} from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { RatingForm, type RatingFormData } from "./RatingForm";

interface ExistingRating {
	id?: string;
	difficulty?: number;
	usefulness?: number;
	comment?: string | null;
	instructor?: string | null;
	instructors?: readonly RatingInstructor[];
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
	const { user } = useAuth();
	// Matches the backend byline, which is "last first".
	const author = user
		? {
				name: [user.lastName, user.firstName].filter(Boolean).join(" "),
				avatarUrl: user.avatarUrl,
			}
		: undefined;

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
			queryClient.invalidateQueries({
				queryKey: getFeedListInfiniteQueryKey(),
			}),
		]);
	};

	const handleSubmit = async (data: RatingFormData) => {
		// A non-empty selection supersedes the legacy text; an empty one leaves it,
		// rather than dropping the rating's only instructor.
		const instructorPayload = {
			instructor_ids: data.instructor_ids,
			...(data.instructor_ids.length > 0 ? { instructor: "" } : {}),
		};
		try {
			if (isEditMode && existingRating?.id) {
				await updateMutation.mutateAsync({
					courseId: courseId,
					ratingId: existingRating.id,
					data: {
						difficulty: data.difficulty,
						usefulness: data.usefulness,
						comment: data.comment ?? "",
						...instructorPayload,
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
						comment: data.comment ?? undefined,
						...instructorPayload,
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

	const existingInstructors = (existingRating?.instructors ?? []).filter(
		(ri): ri is Required<RatingInstructor> => Boolean(ri.id),
	);
	const initialInstructors: Instructor[] = existingInstructors.map((ri) => ({
		id: ri.id,
		first_name: ri.first_name ?? "",
		last_name: ri.last_name ?? "",
		patronymic: ri.patronymic ?? "",
	}));

	const initialData: RatingFormData | undefined = existingRating
		? {
				difficulty: existingRating.difficulty ?? 3,
				usefulness: existingRating.usefulness ?? 3,
				comment: existingRating.comment ?? "",
				instructor_ids: existingInstructors.map((ri) => ri.id),
				instructor: existingRating.instructor ?? "",
				is_anonymous: existingRating.is_anonymous ?? false,
			}
		: undefined;

	const isLoading = createMutation.isPending || updateMutation.isPending;

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent
				className={cn(
					"group/rating-modal flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[500px]",
					// Phones get the whole screen, rising as a sheet instead of zooming.
					"max-sm:inset-0 max-sm:h-dvh max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=closed]:zoom-out-100 max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=open]:zoom-in-100 motion-reduce:animate-none!",
				)}
				data-testid={testIds.rating.modal}
			>
				<DialogHeader className="shrink-0 border-b border-transparent pt-6 pr-12 pb-4 pl-6 text-left transition-colors motion-reduce:transition-none group-has-[[data-scrolled]]/rating-modal:border-border">
					<DialogTitle
						className="leading-snug text-balance"
						data-testid={testIds.rating.modalTitle}
					>
						{courseName?.trim() ||
							(isEditMode ? "Редагувати оцінку" : "Оцінити курс")}
					</DialogTitle>
					<DialogDescription>
						{isEditMode ? "Змініть свою оцінку" : "Поділіться своїм досвідом"}
					</DialogDescription>
				</DialogHeader>

				<RatingForm
					onSubmit={handleSubmit}
					onCancel={onClose}
					isLoading={isLoading}
					isEditMode={isEditMode}
					initialData={initialData}
					offeringId={offeringId}
					courseId={courseId}
					initialInstructors={initialInstructors}
					author={author}
				/>
			</DialogContent>
		</Dialog>
	);
}

export type { RatingFormData } from "./RatingForm";

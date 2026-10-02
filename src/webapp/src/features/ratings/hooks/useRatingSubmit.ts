import { useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/Toaster";
import {
	getCoursesListQueryKey,
	getCoursesRatingsListQueryKey,
	getCoursesRetrieveQueryKey,
	getFeedListInfiniteQueryKey,
	getStudentsMeCoursesRetrieveQueryKey,
	getStudentsMeGradesRateableCountRetrieveQueryKey,
	getStudentsMeGradesRetrieveQueryKey,
	useCoursesRatingsCreate,
	useCoursesRatingsPartialUpdate,
} from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";
import type { RatingAuthor, RatingFormData } from "../components/RatingForm";

interface UseRatingSubmitOptions {
	readonly courseId: string;
	readonly offeringId?: string;
	/** Set when editing; a new rating is created otherwise. */
	readonly ratingId?: string;
	/** False when the caller shows its own confirmation instead of a toast. */
	readonly toastOnSuccess?: boolean;
	/** A follow-up offered on the success toast. */
	readonly successAction?: { label: string; onClick: () => void };
}

/**
 * Creates or updates the student's rating of one course offering and refreshes
 * every view that shows it. Shared by the rating modal and the rate-all page,
 * so both save, toast and invalidate the same way.
 *
 * `submit` resolves to whether the rating was saved.
 */
export function useRatingSubmit({
	courseId,
	offeringId,
	ratingId,
	toastOnSuccess = true,
	successAction,
}: UseRatingSubmitOptions) {
	const queryClient = useQueryClient();
	const createMutation = useCoursesRatingsCreate();
	const updateMutation = useCoursesRatingsPartialUpdate();

	const invalidateRatingQueries = () =>
		Promise.all([
			queryClient.invalidateQueries({
				queryKey: getStudentsMeCoursesRetrieveQueryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: getStudentsMeGradesRetrieveQueryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: getStudentsMeGradesRateableCountRetrieveQueryKey(),
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

	const submit = async (data: RatingFormData): Promise<boolean> => {
		// A non-empty selection supersedes the legacy text; an empty one leaves it,
		// rather than dropping the rating's only instructor.
		const instructorPayload = {
			instructor_ids: data.instructor_ids,
			...(data.instructor_ids.length > 0 ? { instructor: "" } : {}),
		};
		try {
			if (ratingId) {
				await updateMutation.mutateAsync({
					courseId,
					ratingId,
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
						"Не вдалося створити оцінку: відсутній ідентифікатор дисципліни",
					);
					return false;
				}
				await createMutation.mutateAsync({
					courseId,
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

			if (toastOnSuccess) {
				toast.success(
					ratingId ? "Оцінку успішно оновлено" : "Оцінку успішно додано",
					successAction ? { action: successAction, duration: 8000 } : undefined,
				);
			}
			await invalidateRatingQueries();
			return true;
		} catch (error) {
			console.error("Failed to submit rating:", error);
			toast.error("Не вдалося зберегти оцінку. Спробуйте ще раз");
			return false;
		}
	};

	return {
		submit,
		isLoading: createMutation.isPending || updateMutation.isPending,
	};
}

/** The signed-in student as the review byline shows them. */
export function useRatingAuthor(): RatingAuthor | undefined {
	const { user } = useAuth();
	// Matches the backend byline, which is "last first".
	return user
		? {
				name: [user.lastName, user.firstName].filter(Boolean).join(" "),
				avatarUrl: user.avatarUrl,
			}
		: undefined;
}

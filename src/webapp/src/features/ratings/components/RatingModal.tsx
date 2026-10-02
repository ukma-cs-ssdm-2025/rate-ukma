import { useNavigate } from "@tanstack/react-router";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import type { Instructor, RatingInstructor } from "@/lib/api/generated";
import { useStudentsMeGradesRetrieve } from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { useRatingAuthor, useRatingSubmit } from "../hooks/useRatingSubmit";
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
	/** Offer the rest of the student's courses in the success toast. Off where the page already does. */
	readonly offerTheRest?: boolean;
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
	offerTheRest = true,
}: RatingModalProps) {
	const isEditMode = !!existingRating;
	const author = useRatingAuthor();
	const navigate = useNavigate();
	const { isStudent } = useAuth();
	// A fresh rating is the moment to offer the rest of the student's courses.
	const { data: grades } = useStudentsMeGradesRetrieve({
		query: { enabled: isOpen && isStudent && !isEditMode && offerTheRest },
	});
	const othersLeft = (Array.isArray(grades) ? grades : []).filter(
		(row) =>
			row.can_rate && !row.rated && row.course_offering_id !== offeringId,
	).length;
	const { submit, isLoading } = useRatingSubmit({
		courseId,
		offeringId,
		ratingId: isEditMode ? existingRating?.id : undefined,
		successAction:
			offerTheRest && !isEditMode && othersLeft > 0
				? {
						label: "Оцінити решту",
						onClick: () => navigate({ to: "/rate" }),
					}
				: undefined,
	});

	const handleSubmit = async (data: RatingFormData) => {
		if (!(await submit(data))) return;
		onSuccess?.();
		onClose();
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
						{isEditMode
							? "Змініть свою оцінку"
							: "Оцінку й відгук можна змінити будь-коли"}
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

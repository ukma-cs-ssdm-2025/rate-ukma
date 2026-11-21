import * as React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { DialogFooter } from "@/components/ui/Dialog";
import { Form } from "@/components/ui/Form";
import type { Instructor } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { ratingSchema } from "../ratingFormSchema";
import type { RatingFormData } from "../ratingFormSchema";
import type { RatingAuthor } from "./RatingFormFields";
import { RatingFormFields } from "./RatingFormFields";

interface RatingFormProps {
	readonly onSubmit: (data: RatingFormData) => void | Promise<void>;
	readonly onCancel: () => void;
	readonly isLoading?: boolean;
	readonly isEditMode?: boolean;
	readonly initialData?: RatingFormData;
	readonly offeringId?: string;
	readonly courseId?: string;
	readonly initialInstructors?: readonly Instructor[];
	readonly author?: RatingAuthor;
}

export function RatingForm({
	onSubmit,
	onCancel,
	isLoading = false,
	isEditMode = false,
	initialData,
	offeringId,
	courseId,
	initialInstructors,
	author,
}: RatingFormProps) {
	const form = useForm<RatingFormData>({
		resolver: zodResolver(ratingSchema),
		defaultValues: initialData || {
			difficulty: 0,
			usefulness: 0,
			comment: "",
			instructor_ids: [],
			instructor: "",
			is_anonymous: false,
		},
	});

	React.useEffect(() => {
		if (initialData && !form.formState.isSubmitting) {
			form.reset(initialData);
		}
	}, [initialData, form]);

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="group/rating-form flex min-h-0 flex-1 flex-col overflow-hidden"
				data-testid={testIds.rating.form}
			>
				<RatingFormFields
					control={form.control}
					offeringId={offeringId}
					courseId={courseId}
					initialInstructors={initialInstructors}
					legacyInstructor={initialData?.instructor?.trim() || undefined}
					author={author}
				/>

				<DialogFooter className="shrink-0 border-t border-transparent px-6 py-4 transition-colors motion-reduce:transition-none group-has-[[data-more-below]]/rating-form:border-border">
					<Button
						type="button"
						variant="ghost"
						onClick={onCancel}
						disabled={isLoading}
						className="w-full sm:w-auto"
						data-testid={testIds.rating.cancelButton}
					>
						Скасувати
					</Button>
					<Button
						type="submit"
						size="lg"
						disabled={isLoading}
						className="w-full sm:w-auto"
						data-testid={testIds.rating.submitButton}
					>
						{(() => {
							if (isLoading) {
								return "Надсилання...";
							}
							if (isEditMode) {
								return "Зберегти зміни";
							}
							return "Надіслати оцінку";
						})()}
					</Button>
				</DialogFooter>
			</form>
		</Form>
	);
}

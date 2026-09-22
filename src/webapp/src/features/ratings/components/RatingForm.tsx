import * as React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Control } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DialogFooter } from "@/components/ui/Dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/Form";
import { Textarea } from "@/components/ui/Textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";
import { InstructorMultiSelect } from "@/features/instructors/components/InstructorMultiSelect";
import type { Instructor } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import {
	difficultyDescriptions,
	usefulnessDescriptions,
} from "../definitions/ratingDefinitions";

const COMMENT_MAX_LENGTH = 2000;

const ratingSchema = z.object({
	difficulty: z
		.number()
		.min(1, "Оцінка складності є обов'язковою")
		.max(5, "Оцінка складності повинна бути від 1 до 5"),
	usefulness: z
		.number()
		.min(1, "Оцінка корисності є обов'язковою")
		.max(5, "Оцінка корисності повинна бути від 1 до 5"),
	comment: z
		.string()
		.transform((val) => val?.trim() || undefined)
		.optional(),
	instructor_ids: z.array(z.string().uuid()),
	// Legacy free-text instructor, kept for backward compatibility with old clients.
	// The form no longer edits it — new ratings pick Instructor entities instead.
	instructor: z.string().max(256).optional(),
	is_anonymous: z.boolean(),
});

export type RatingFormData = z.infer<typeof ratingSchema>;

function ScoreInput({
	value,
	onChange,
	onBlur,
	descriptions,
	"data-testid": dataTestId,
	...rest
}: Readonly<{
	value: number;
	onChange: (value: number) => void;
	onBlur?: () => void;
	descriptions: Record<number, string>;
	"data-testid"?: string;
	id?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: boolean;
}>) {
	return (
		<div data-testid={dataTestId}>
			<ToggleGroup
				type="single"
				variant="outline"
				value={String(value)}
				onValueChange={(next) => {
					if (next) {
						onChange(Number(next));
					}
				}}
				onBlur={onBlur}
				aria-label="Оцінка"
				className="w-full"
				{...rest}
			>
				{[1, 2, 3, 4, 5].map((score) => (
					<ToggleGroupItem
						key={score}
						value={String(score)}
						aria-label={`${score} з 5`}
						className="flex-1"
					>
						{score}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
			<p className="mt-1.5 min-h-8 text-xs text-muted-foreground">
				{descriptions[value as keyof typeof descriptions] ?? ""}
			</p>
		</div>
	);
}

function RatingFormFields({
	control,
	offeringId,
	courseId,
	initialInstructors,
	legacyInstructor,
}: Readonly<{
	control: Control<RatingFormData>;
	offeringId?: string;
	courseId?: string;
	initialInstructors?: readonly Instructor[];
	legacyInstructor?: string;
}>) {
	const comment = useWatch({ control, name: "comment" }) ?? "";

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4">
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<FormField<RatingFormData, "difficulty">
					control={control}
					name="difficulty"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Складність</FormLabel>
							<FormControl>
								<ScoreInput
									value={field.value ?? 3}
									onChange={field.onChange}
									onBlur={field.onBlur}
									descriptions={difficultyDescriptions}
									data-testid={testIds.rating.difficultySlider}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField<RatingFormData, "usefulness">
					control={control}
					name="usefulness"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Корисність</FormLabel>
							<FormControl>
								<ScoreInput
									value={field.value ?? 3}
									onChange={field.onChange}
									onBlur={field.onBlur}
									descriptions={usefulnessDescriptions}
									data-testid={testIds.rating.usefulnessSlider}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
			</div>

			<FormField<RatingFormData, "instructor_ids">
				control={control}
				name="instructor_ids"
				render={({ field }) => (
					<FormItem>
						<FormLabel>Викладачі (необов'язково)</FormLabel>
						{legacyInstructor && (
							<p
								className="text-sm text-muted-foreground"
								data-testid={testIds.rating.legacyInstructorText}
							>
								Раніше вказано текстом:{" "}
								<span className="font-medium">{legacyInstructor}</span>
							</p>
						)}
						<FormControl>
							<InstructorMultiSelect
								value={field.value ?? []}
								onChange={field.onChange}
								initialOptions={initialInstructors}
								courseOfferingId={offeringId}
								courseId={courseId}
								data-testid={testIds.rating.instructorMultiSelect}
							/>
						</FormControl>
						<FormDescription>
							{legacyInstructor
								? "Оберіть викладачів зі списку — вони замінять текстовий запис"
								: "Можна обрати кількох викладачів, які вели курс"}
						</FormDescription>
						<FormMessage />
					</FormItem>
				)}
			/>

			<FormField<RatingFormData, "comment">
				control={control}
				name="comment"
				render={({ field }) => (
					<FormItem>
						<FormLabel>Додаткові коментарі (необов'язково)</FormLabel>
						<FormControl>
							<Textarea
								className="field-sizing-fixed min-h-32 max-h-[40dvh] resize-y overflow-y-auto"
								placeholder="Поділіться будь-якими думками про цей курс..."
								rows={6}
								maxLength={COMMENT_MAX_LENGTH}
								{...field}
								data-testid={testIds.rating.commentTextarea}
							/>
						</FormControl>
						<div className="flex items-center justify-between gap-2">
							<FormDescription>
								Допоможіть іншим студентам, розказавши про свій досвід
							</FormDescription>
							<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
								{comment.length} / {COMMENT_MAX_LENGTH}
							</span>
						</div>
						<FormMessage />
					</FormItem>
				)}
			/>

			<FormField
				control={control}
				name="is_anonymous"
				render={({ field }) => (
					<FormItem>
						<div className="flex items-center gap-2">
							<FormControl className="flex-none">
								<Checkbox
									checked={field.value}
									onCheckedChange={(checked) =>
										field.onChange(checked === true)
									}
									data-testid={testIds.rating.anonymousCheckbox}
								/>
							</FormControl>
							<FormLabel>Анонімне повідомлення</FormLabel>
						</div>
						<FormDescription>
							Ваше ім'я не відображатиметься в огляді
						</FormDescription>
						<FormMessage />
					</FormItem>
				)}
			/>
		</div>
	);
}

interface RatingFormProps {
	readonly onSubmit: (data: RatingFormData) => void | Promise<void>;
	readonly onCancel: () => void;
	readonly isLoading?: boolean;
	readonly isEditMode?: boolean;
	readonly initialData?: RatingFormData;
	readonly offeringId?: string;
	readonly courseId?: string;
	readonly initialInstructors?: readonly Instructor[];
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
}: RatingFormProps) {
	const form = useForm<RatingFormData>({
		resolver: zodResolver(ratingSchema),
		defaultValues: initialData || {
			difficulty: 3,
			usefulness: 3,
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
				className="flex min-h-0 flex-1 flex-col overflow-hidden"
				data-testid={testIds.rating.form}
			>
				<RatingFormFields
					control={form.control}
					offeringId={offeringId}
					courseId={courseId}
					initialInstructors={initialInstructors}
					legacyInstructor={initialData?.instructor?.trim() || undefined}
				/>

				<DialogFooter className="shrink-0 border-t px-6 py-4">
					<Button
						type="button"
						variant="secondary"
						onClick={onCancel}
						disabled={isLoading}
						data-testid={testIds.rating.cancelButton}
					>
						Скасувати
					</Button>
					<Button
						type="submit"
						disabled={isLoading}
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

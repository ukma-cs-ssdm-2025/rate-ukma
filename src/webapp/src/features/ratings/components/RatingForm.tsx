import * as React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/Form";
import { Slider } from "@/components/ui/Slider";
import { Textarea } from "@/components/ui/Textarea";
import {
	difficultyDescriptions,
	usefulnessDescriptions,
} from "../definitions/ratingDefinitions";

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
	is_anonymous: z.boolean(),
});

export type RatingFormData = z.infer<typeof ratingSchema>;

interface RatingFormProps {
	readonly onSubmit: (data: RatingFormData) => void | Promise<void>;
	readonly onCancel: () => void;
	readonly isLoading?: boolean;
	readonly isEditMode?: boolean;
	readonly initialData?: RatingFormData;
	readonly onDelete?: () => void;
}

export function RatingForm({
	onSubmit,
	onCancel,
	isLoading = false,
	isEditMode = false,
	initialData,
	onDelete,
}: RatingFormProps) {
	const form = useForm<RatingFormData>({
		resolver: zodResolver(ratingSchema),
		defaultValues: initialData || {
			difficulty: 3,
			usefulness: 3,
			comment: "",
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
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
				<FormField<RatingFormData, "difficulty">
					control={form.control}
					name="difficulty"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Складність: {field.value ?? 3}/5</FormLabel>
							<FormControl>
								<Slider
									value={[field.value ?? 3]}
									onValueChange={(next) => field.onChange(next[0])}
									min={1}
									max={5}
									step={1}
									className="w-full"
									title={
										difficultyDescriptions[
											(field.value ?? 3) as keyof typeof difficultyDescriptions
										]
									}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField<RatingFormData, "usefulness">
					control={form.control}
					name="usefulness"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Корисність: {field.value ?? 3}/5</FormLabel>
							<FormControl>
								<Slider
									value={[field.value ?? 3]}
									onValueChange={(next) => field.onChange(next[0])}
									min={1}
									max={5}
									step={1}
									className="w-full"
									title={
										usefulnessDescriptions[
											(field.value ?? 3) as keyof typeof usefulnessDescriptions
										]
									}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField<RatingFormData, "comment">
					control={form.control}
					name="comment"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Додаткові коментарі (необов'язково)</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Поділіться будь-якими думками про цей курс..."
									{...field}
								/>
							</FormControl>
							<FormDescription>
								Допоможіть іншим студентам, розказавши про свій досвід
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="is_anonymous"
					render={({ field }) => (
						<FormItem className="space-y-1">
							<div className="flex items-center gap-2">
								<FormControl className="flex-none">
									<Checkbox
										checked={field.value}
										onCheckedChange={(checked) =>
											field.onChange(checked ?? false)
										}
									/>
								</FormControl>
								<FormLabel className="m-0 text-sm font-medium">
									Анонімне повідомлення
								</FormLabel>
							</div>
							<FormDescription className="text-sm">
								Ваше ім'я не відображатиметься в огляді
							</FormDescription>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="flex justify-end gap-3">
					{isEditMode && onDelete && (
						<Button
							type="button"
							variant="outline"
							onClick={() => onDelete?.()}
							disabled={isLoading}
							className="flex items-center gap-2"
						>
							<Trash2 className="h-4 w-4 text-destructive" />
							Видалити
						</Button>
					)}
					<Button
						type="button"
						variant="outline"
						onClick={onCancel}
						disabled={isLoading}
					>
						Скасувати
					</Button>
					<Button type="submit" disabled={isLoading}>
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
				</div>
			</form>
		</Form>
	);
}

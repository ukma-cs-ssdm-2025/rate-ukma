import * as React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Star } from "lucide-react";
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
import { Textarea } from "@/components/ui/Textarea";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
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

function StarRatingInput({
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
	const [hovered, setHovered] = React.useState<number | null>(null);
	const [dragOrigin, setDragOrigin] = React.useState<number | null>(null);
	const [dragTarget, setDragTarget] = React.useState<number | null>(null);
	const dragging = dragOrigin !== null;
	const displayValue = hovered ?? value;

	const handlePointerDown = (star: number) => {
		setDragOrigin(star);
		setDragTarget(star);
		onChange(star);
	};

	const handlePointerEnter = (star: number) => {
		setHovered(star);
		if (dragging) {
			setDragTarget(star);
			onChange(star);
		}
	};

	React.useEffect(() => {
		if (!dragging) return;
		const up = () => {
			setDragOrigin(null);
			setDragTarget(null);
		};
		globalThis.addEventListener("pointerup", up);
		return () => globalThis.removeEventListener("pointerup", up);
	}, [dragging]);

	return (
		<div data-testid={dataTestId}>
			<fieldset
				aria-label="Оцінка"
				className="flex gap-0.5 select-none touch-none border-none p-0 m-0"
				onMouseLeave={() => {
					if (!dragging) setHovered(null);
				}}
				onBlur={onBlur}
				{...rest}
			>
				{[1, 2, 3, 4, 5].map((star) => {
					const isFilled = star <= displayValue;
					const isPressed =
						dragging &&
						dragOrigin !== null &&
						dragTarget !== null &&
						star >= Math.min(dragOrigin, dragTarget) &&
						star <= Math.max(dragOrigin, dragTarget);

					return (
						<button
							key={star}
							type="button"
							className={cn(
								"rounded-md p-1 transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								isPressed ? "scale-90" : "hover:scale-110 active:scale-95",
							)}
							onPointerDown={() => handlePointerDown(star)}
							onPointerEnter={() => handlePointerEnter(star)}
							aria-label={`${star} з 5`}
						>
							<Star
								className={cn(
									"h-7 w-7 transition-colors duration-100",
									isFilled
										? "fill-primary text-primary drop-shadow-sm"
										: "fill-transparent text-muted-foreground/30",
								)}
							/>
						</button>
					);
				})}
			</fieldset>
			<p className="mt-1.5 text-xs text-muted-foreground min-h-8">
				{descriptions[displayValue as keyof typeof descriptions] ?? ""}
			</p>
		</div>
	);
}

interface RatingFormProps {
	readonly onSubmit: (data: RatingFormData) => void | Promise<void>;
	readonly onCancel: () => void;
	readonly isLoading?: boolean;
	readonly isEditMode?: boolean;
	readonly initialData?: RatingFormData;
}

export function RatingForm({
	onSubmit,
	onCancel,
	isLoading = false,
	isEditMode = false,
	initialData,
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
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="space-y-6"
				data-testid={testIds.rating.form}
			>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField<RatingFormData, "difficulty">
						control={form.control}
						name="difficulty"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Складність</FormLabel>
								<FormControl>
									<StarRatingInput
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
						control={form.control}
						name="usefulness"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Корисність</FormLabel>
								<FormControl>
									<StarRatingInput
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
									data-testid={testIds.rating.commentTextarea}
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
										data-testid={testIds.rating.anonymousCheckbox}
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
					<Button
						type="button"
						variant="outline"
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
				</div>
			</form>
		</Form>
	);
}

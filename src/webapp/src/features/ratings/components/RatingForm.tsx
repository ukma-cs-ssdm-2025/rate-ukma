import * as React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Star } from "lucide-react";
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

const SCORE_OPTIONS = [1, 2, 3, 4, 5] as const;

// Descriptions read as "Коротко - детальніше"; the input shows the short head.
function getShortDescription(
	descriptions: Record<number, string>,
	value: number,
): string {
	const full = descriptions[value] ?? "";
	const [head] = full.split(" - ");
	return head?.trim() || full;
}

function ScoreInput({
	value,
	onChange,
	onBlur,
	descriptions,
	labelId,
	"data-testid": dataTestId,
	...rest
}: Readonly<{
	value: number;
	onChange: (value: number) => void;
	onBlur?: () => void;
	descriptions: Record<number, string>;
	labelId: string;
	"data-testid"?: string;
	id?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: boolean;
}>) {
	const [hovered, setHovered] = React.useState<number | null>(null);
	const [dragging, setDragging] = React.useState(false);
	const buttons = React.useRef<Array<HTMLButtonElement | null>>([]);
	const shown = hovered ?? value;

	React.useEffect(() => {
		if (!dragging) return;
		const stop = () => setDragging(false);
		globalThis.addEventListener("pointerup", stop);
		return () => globalThis.removeEventListener("pointerup", stop);
	}, [dragging]);

	const select = (next: number) => {
		onChange(next);
		buttons.current[next - 1]?.focus();
	};

	const onGroupKeyDown = (event: React.KeyboardEvent) => {
		switch (event.key) {
			case "ArrowRight":
			case "ArrowUp":
				event.preventDefault();
				select(Math.min(5, value + 1));
				break;
			case "ArrowLeft":
			case "ArrowDown":
				event.preventDefault();
				select(Math.max(1, value - 1));
				break;
			case "Home":
				event.preventDefault();
				select(1);
				break;
			case "End":
				event.preventDefault();
				select(5);
				break;
		}
	};

	return (
		<div data-testid={dataTestId}>
			<div
				role="radiogroup"
				aria-labelledby={labelId}
				onBlur={onBlur}
				onKeyDown={onGroupKeyDown}
				onPointerLeave={() => {
					setHovered(null);
					setDragging(false);
				}}
				onPointerUp={() => setDragging(false)}
				className="flex touch-pan-y select-none gap-0.5"
				{...rest}
			>
				{SCORE_OPTIONS.map((score) => {
					const isFilled = score <= shown;
					return (
						<button
							key={score}
							ref={(node) => {
								buttons.current[score - 1] = node;
							}}
							type="button"
							role="radio"
							aria-checked={score === value}
							aria-label={`${score} з 5`}
							tabIndex={score === value ? 0 : -1}
							onClick={() => onChange(score)}
							onPointerDown={() => {
								setDragging(true);
								onChange(score);
							}}
							onPointerEnter={() => {
								setHovered(score);
								if (dragging) {
									onChange(score);
								}
							}}
							className="min-h-10 min-w-10 rounded-md p-1 transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none sm:min-h-0 sm:min-w-0 [@media(hover:hover)]:hover:scale-110 active:scale-95 motion-reduce:transform-none"
						>
							<Star
								aria-hidden="true"
								className={
									isFilled
										? "size-8 fill-primary text-primary transition-colors duration-100 motion-reduce:transition-none sm:size-7"
										: "size-8 fill-transparent text-muted-foreground/40 transition-colors duration-100 motion-reduce:transition-none sm:size-7"
								}
							/>
						</button>
					);
				})}
			</div>
			<p
				aria-live="polite"
				className="mt-1.5 flex items-baseline gap-2 text-sm text-muted-foreground"
			>
				<span className="font-medium text-foreground tabular-nums">
					{shown}
				</span>
				<span>{getShortDescription(descriptions, shown)}</span>
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
	const difficultyLabelId = React.useId();
	const usefulnessLabelId = React.useId();
	const scrollRef = React.useRef<HTMLDivElement>(null);
	const [edges, setEdges] = React.useState({
		scrolled: false,
		moreBelow: false,
	});

	// Dividers only mark content hidden under the header or footer, so they
	// follow the scroll position instead of always framing the form.
	const updateEdges = React.useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		const scrolled = el.scrollTop > 0;
		const moreBelow = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
		setEdges((prev) =>
			prev.scrolled === scrolled && prev.moreBelow === moreBelow
				? prev
				: { scrolled, moreBelow },
		);
	}, []);

	React.useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		updateEdges();
		const observer = new ResizeObserver(updateEdges);
		observer.observe(el);
		for (const child of el.children) observer.observe(child);
		return () => observer.disconnect();
	}, [updateEdges]);

	return (
		<div
			ref={scrollRef}
			onScroll={updateEdges}
			data-scrolled={edges.scrolled || undefined}
			data-more-below={edges.moreBelow || undefined}
			className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5 sm:gap-6 sm:py-4"
		>
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
				<FormField<RatingFormData, "difficulty">
					control={control}
					name="difficulty"
					render={({ field }) => {
						const current = field.value ?? 3;
						return (
							<FormItem>
								<FormLabel id={difficultyLabelId}>Складність</FormLabel>
								<FormControl>
									<ScoreInput
										value={current}
										onChange={field.onChange}
										onBlur={field.onBlur}
										descriptions={difficultyDescriptions}
										labelId={difficultyLabelId}
										data-testid={testIds.rating.difficultySlider}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						);
					}}
				/>

				<FormField<RatingFormData, "usefulness">
					control={control}
					name="usefulness"
					render={({ field }) => {
						const current = field.value ?? 3;
						return (
							<FormItem>
								<FormLabel id={usefulnessLabelId}>Корисність</FormLabel>
								<FormControl>
									<ScoreInput
										value={current}
										onChange={field.onChange}
										onBlur={field.onBlur}
										descriptions={usefulnessDescriptions}
										labelId={usefulnessLabelId}
										data-testid={testIds.rating.usefulnessSlider}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						);
					}}
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
						<div className="flex items-baseline justify-between gap-3">
							<FormLabel>Додаткові коментарі (необов'язково)</FormLabel>
							<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
								{comment.length} / {COMMENT_MAX_LENGTH}
							</span>
						</div>
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
				className="group/rating-form flex min-h-0 flex-1 flex-col overflow-hidden"
				data-testid={testIds.rating.form}
			>
				<RatingFormFields
					control={form.control}
					offeringId={offeringId}
					courseId={courseId}
					initialInstructors={initialInstructors}
					legacyInstructor={initialData?.instructor?.trim() || undefined}
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

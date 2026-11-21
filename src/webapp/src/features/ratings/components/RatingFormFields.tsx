import * as React from "react";

import { Eye, EyeOff } from "lucide-react";
import { useWatch } from "react-hook-form";
import type { Control } from "react-hook-form";
import { Checkbox } from "@/components/ui/Checkbox";
import {
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/Form";
import { Textarea } from "@/components/ui/Textarea";
import { InstructorMultiSelect } from "@/features/instructors/components/InstructorMultiSelect";
import { InstructorQuickPicks } from "@/features/instructors/components/InstructorQuickPicks";
import { pickCourseInstructors } from "@/features/instructors/courseInstructorPicks";
import type { Instructor } from "@/lib/api/generated";
import { useCoursesInstructorsRetrieve } from "@/lib/api/generated";
import {
	difficultyDescriptions,
	usefulnessDescriptions,
} from "@/lib/score-descriptions";
import { testIds } from "@/lib/test-ids";
import {
	ANONYMOUS_REVIEW_NAME,
	DEFAULT_STUDENT_NAME,
} from "../definitions/ratingDefinitions";
import { RatingCardBody } from "./RatingCardBody";
import type { RatingFormData } from "../ratingFormSchema";
import { ScoreInput } from "./RatingScoreInput";

export interface RatingAuthor {
	readonly name: string;
	readonly avatarUrl?: string | null;
}

export function RatingFormFields({
	control,
	offeringId,
	courseId,
	initialInstructors,
	legacyInstructor,
	author,
}: Readonly<{
	control: Control<RatingFormData>;
	author?: RatingAuthor;
	offeringId?: string;
	courseId?: string;
	initialInstructors?: readonly Instructor[];
	legacyInstructor?: string;
}>) {
	const comment = useWatch({ control, name: "comment" }) ?? "";
	const isAnonymous = useWatch({ control, name: "is_anonymous" }) ?? false;
	const difficulty = useWatch({ control, name: "difficulty" });
	const usefulness = useWatch({ control, name: "usefulness" });
	const instructorIds = useWatch({ control, name: "instructor_ids" });
	const [previewOpen, setPreviewOpen] = React.useState(false);
	const { data: courseInstructors } = useCoursesInstructorsRetrieve(
		courseId ?? "",
		offeringId ? { offering_id: offeringId } : undefined,
		{ query: { enabled: Boolean(courseId) } },
	);
	const quickPicks = pickCourseInstructors(
		courseInstructors?.items ?? [],
		instructorIds ?? [],
	).map((item) => item.instructor);
	const instructorOptions = React.useMemo(
		() => [
			...(initialInstructors ?? []),
			...(courseInstructors?.items ?? []).map((item) => item.instructor),
		],
		[initialInstructors, courseInstructors],
	);
	const [searchedInstructors, setSearchedInstructors] = React.useState<
		ReadonlyMap<string, Instructor>
	>(() => new Map());
	const rememberInstructor = React.useCallback((instructor: Instructor) => {
		const { id } = instructor;
		if (!id) {
			return;
		}
		setSearchedInstructors((current) => new Map(current).set(id, instructor));
	}, []);
	const selectedInstructors = (instructorIds ?? []).flatMap((id) => {
		const instructor =
			searchedInstructors.get(id) ??
			instructorOptions.find((option) => option.id === id);
		return instructor ? [instructor] : [];
	});
	const signature = isAnonymous
		? ANONYMOUS_REVIEW_NAME
		: author?.name || DEFAULT_STUDENT_NAME;
	const difficultyLabelId = React.useId();
	const usefulnessLabelId = React.useId();
	const scrollRef = React.useRef<HTMLDivElement>(null);
	const [edges, setEdges] = React.useState({
		scrolled: false,
		moreBelow: false,
	});

	const updateEdges = React.useCallback(() => {
		const el = scrollRef.current;
		if (!el) {
			return;
		}
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
		if (!el) {
			return;
		}
		updateEdges();
		const observer = new ResizeObserver(updateEdges);
		observer.observe(el);
		for (const child of el.children) {
			observer.observe(child);
		}
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
			<div className="space-y-4">
				<FormField<RatingFormData, "difficulty">
					control={control}
					name="difficulty"
					render={({ field }) => (
						<FormItem>
							<FormControl>
								<ScoreInput
									label={
										<FormLabel id={difficultyLabelId}>Складність</FormLabel>
									}
									value={field.value ?? 3}
									onChange={field.onChange}
									onBlur={field.onBlur}
									descriptions={difficultyDescriptions}
									labelId={difficultyLabelId}
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
							<FormControl>
								<ScoreInput
									label={
										<FormLabel id={usefulnessLabelId}>Корисність</FormLabel>
									}
									value={field.value ?? 3}
									onChange={field.onChange}
									onBlur={field.onBlur}
									descriptions={usefulnessDescriptions}
									labelId={usefulnessLabelId}
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
						<FormLabel>
							Викладачі
							<span className="font-normal text-muted-foreground">
								необов'язково
							</span>
						</FormLabel>
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
								onOptionPicked={rememberInstructor}
								initialOptions={instructorOptions}
								courseOfferingId={offeringId}
								courseId={courseId}
								data-testid={testIds.rating.instructorMultiSelect}
							/>
						</FormControl>
						{quickPicks.length > 0 && !legacyInstructor ? (
							<InstructorQuickPicks
								instructors={quickPicks}
								onPick={(id) => field.onChange([...(field.value ?? []), id])}
							/>
						) : (
							<FormDescription>
								{legacyInstructor
									? "Оберіть викладачів зі списку — вони замінять текстовий запис"
									: "Можна обрати кількох викладачів, які вели дисципліну"}
							</FormDescription>
						)}
						<FormMessage />
					</FormItem>
				)}
			/>

			<FormField<RatingFormData, "comment">
				control={control}
				name="comment"
				render={({ field }) => (
					<FormItem>
						<FormLabel>
							Коментар
							<span className="font-normal text-muted-foreground">
								необов'язково
							</span>
						</FormLabel>
						<FormControl>
							<Textarea
								className="field-sizing-fixed min-h-32 max-h-[40dvh] resize-y overflow-y-auto"
								placeholder="Поділіться будь-якими думками про цю дисципліну..."
								rows={6}
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
						<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
							<div className="flex items-center gap-2">
								<FormControl>
									<Checkbox
										checked={field.value}
										onCheckedChange={(checked) =>
											field.onChange(checked === true)
										}
										data-testid={testIds.rating.anonymousCheckbox}
									/>
								</FormControl>
								<FormLabel className="font-normal">Анонімний відгук</FormLabel>
							</div>
							<button
								type="button"
								aria-expanded={previewOpen}
								onClick={() => setPreviewOpen((open) => !open)}
								className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
							>
								{previewOpen ? (
									<EyeOff className="size-4" aria-hidden />
								) : (
									<Eye className="size-4" aria-hidden />
								)}
								Як побачать інші
							</button>
						</div>
						{previewOpen && (
							<div
								role="region"
								aria-label="Попередній перегляд відгуку"
								className="rounded-xl bg-muted/50 p-3.5 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
							>
								<RatingCardBody
									displayName={signature}
									isAnonymous={isAnonymous}
									avatarUrl={isAnonymous ? null : author?.avatarUrl}
									createdAt={new Date().toISOString()}
									difficulty={difficulty || undefined}
									usefulness={usefulness || undefined}
									comment={comment.trim() || null}
									instructors={selectedInstructors}
									instructor={legacyInstructor}
									commentEmptyMessage="Без текстового відгуку"
									upvotes={0}
									downvotes={0}
									viewerVote={null}
								/>
							</div>
						)}
						<FormMessage />
					</FormItem>
				)}
			/>
		</div>
	);
}

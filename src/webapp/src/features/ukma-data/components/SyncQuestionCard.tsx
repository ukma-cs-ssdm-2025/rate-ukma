import { useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { SyncQuestion } from "@/lib/api/generated";
import { useUkmaDataSyncQuestionAnswer } from "@/lib/api/generated";
import { actionFailure } from "../syncActions";
import { countWith, RATINGS } from "../syncFormat";
import { invalidateSyncQueries } from "../syncQueries";
import {
	answeredText,
	answerPreview,
	choiceTitle,
	courseChoice,
	offeringText,
	questionChoices,
	questionTitle,
} from "../syncQuestions";
import type { QuestionChoice } from "../syncQuestions";
import { Ago } from "./Term";

interface Checked {
	choice: QuestionChoice;
	text: string;
}

function yearsText(years: readonly number[]): string {
	const first = years[0];
	const last = years.at(-1);
	if (first === undefined || last === undefined) {
		return "";
	}
	return first === last ? `${first}` : `${first}–${last}`;
}

function CourseColumn({
	course,
	suggested,
	choice,
	busy,
	onChoose,
}: Readonly<{
	course: SyncQuestion["courses"][number];
	suggested: boolean;
	choice: QuestionChoice | null;
	busy: boolean;
	onChoose: (choice: QuestionChoice) => void;
}>) {
	const facts = [
		course.department,
		yearsText(course.years),
		course.ratings > 0 ? countWith(course.ratings, RATINGS) : "без оцінок",
	].filter((part) => part.length > 0);
	return (
		<div className="flex min-w-0 flex-col gap-2 px-4 py-3 sm:px-5">
			<a
				href={course.url}
				title={course.title}
				className="line-clamp-2 font-medium break-words underline-offset-4 hover:underline"
			>
				{course.title}
			</a>
			<p className="text-sm text-muted-foreground">{facts.join(", ")}</p>
			{suggested ? (
				<p className="text-sm text-muted-foreground">Пропонуємо лишити цю</p>
			) : null}
			{choice === null ? null : (
				<Button
					size="sm"
					variant={suggested ? "default" : "outline"}
					className="mt-auto self-start"
					disabled={busy}
					onClick={() => onChoose(choice)}
				>
					{choice.label}
				</Button>
			)}
		</div>
	);
}

export function SyncQuestionCard({
	question,
}: Readonly<{ question: SyncQuestion }>) {
	const queryClient = useQueryClient();
	const answer = useUkmaDataSyncQuestionAnswer();
	const [checked, setChecked] = useState<Checked | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [editing, setEditing] = useState(false);
	const answered = answeredText(question);
	const busy = answer.isPending;
	const open = answered === null || editing;

	const check = (choice: QuestionChoice) => {
		setError(null);
		answer.mutate(
			{
				changeId: question.id,
				data: { answer: choice.answer, into: choice.into, dry_run: true },
			},
			{
				onSuccess: (response) =>
					setChecked({
						choice,
						text: answerPreview(response.detail, response.ratings),
					}),
				onError: (failure) => setError(actionFailure(failure).text),
			},
		);
	};
	const write = () => {
		if (checked === null) {
			return;
		}
		const { choice } = checked;
		setChecked(null);
		setEditing(false);
		answer.mutate(
			{
				changeId: question.id,
				data: { answer: choice.answer, into: choice.into, dry_run: false },
			},
			{
				onError: (failure) => setError(actionFailure(failure).text),
				onSettled: () => invalidateSyncQueries(queryClient),
			},
		);
	};

	return (
		<div className="overflow-hidden rounded-xl border bg-card">
			<div className="space-y-1 px-4 py-3 sm:px-5">
				<h3 className="font-medium">{questionTitle(question.kind)}</h3>
				{question.ukma_title ? (
					<p className="line-clamp-2 text-sm text-muted-foreground">
						У САЗ: {question.ukma_title}
						{question.ukma_department ? `, ${question.ukma_department}` : ""}
						{offeringText(question.offering)}
					</p>
				) : null}
			</div>
			<div className="grid divide-y border-t sm:grid-flow-col sm:auto-cols-fr sm:divide-x sm:divide-y-0">
				{question.courses.map((course) => (
					<CourseColumn
						key={course.id}
						course={course}
						suggested={course.id === question.suggested_into}
						choice={open ? courseChoice(question, course) : null}
						busy={busy}
						onChoose={check}
					/>
				))}
			</div>
			<div className="flex flex-wrap items-center gap-2 border-t px-4 py-3 text-sm sm:px-5">
				{open ? (
					questionChoices(question).map((choice) => (
						<Button
							key={choice.answer}
							size="sm"
							variant="outline"
							disabled={busy}
							onClick={() => check(choice)}
						>
							{choice.label}
						</Button>
					))
				) : (
					<>
						<p className="text-muted-foreground">
							{answered}{" "}
							{question.answer ? (
								<Ago iso={question.answer.decided_at} />
							) : null}
						</p>
						<Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
							Змінити
						</Button>
					</>
				)}
				{error === null ? null : (
					<p role="alert" className="basis-full text-destructive">
						{error}
					</p>
				)}
			</div>
			<ConfirmDialog
				open={checked !== null}
				onOpenChange={(next) => {
					if (!next) {
						setChecked(null);
					}
				}}
				onConfirm={write}
				title={checked === null ? "" : choiceTitle(question, checked.choice)}
				description={checked?.text ?? ""}
				confirmText="Записати відповідь"
				cancelText="Скасувати"
			/>
		</div>
	);
}

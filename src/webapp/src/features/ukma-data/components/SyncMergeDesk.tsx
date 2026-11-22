import { useState } from "react";

import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { SyncQuestion, SyncQuestionCourse } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import { useDeskAnswers } from "../hooks/useDeskAnswers";
import { useSyncQuestions } from "../hooks/useSyncQuestions";
import type { ConfirmRequest } from "../syncConfirm";
import {
	deskPair,
	deskProgress,
	firstOpen,
	idsAnswered,
	keepReason,
	mergeAsk,
	mergeOutcome,
	nextIndex,
	offeringChips,
	progressLabel,
} from "../syncDesk";
import type { DeskAnswer } from "../syncDesk";
import { countWith } from "../syncFormat";
import { mergeDecisionsRequest } from "../syncRequests";
import { cleanTitle, ratingsText, SEMESTERS } from "../syncWords";
import { DataBack, DataOutcome, Kbd } from "./DataBits";
import { DeskHead, useDeskKeys } from "./DataDesk";
import { DecisionsBar, LaterButton } from "./SyncDeskBits";
import { DataTableEmpty, DataTableSkeleton } from "./DataTable";
import { UkmaDataError } from "./UkmaDataError";

function answerText(answer: DeskAnswer | undefined): string | null {
	if (answer?.answer === "merge") {
		return "Ваше рішення: об'єднати";
	}
	return answer?.answer === "keep_apart"
		? "Ваше рішення: залишити окремо"
		: null;
}

function PageCard({
	course,
	stays,
}: Readonly<{ course: SyncQuestionCourse; stays: boolean }>) {
	const chips = offeringChips(course);
	return (
		<article
			className={cn(
				"flex flex-col gap-3 rounded-xl border bg-card p-5",
				stays && "border-2 border-primary",
			)}
		>
			<p
				className={cn(
					"text-xs",
					stays ? "text-primary" : "text-muted-foreground",
				)}
			>
				{stays ? "Залишиться ця сторінка" : "Ця сторінка зникне"}
			</p>
			<h3 className="text-lg font-semibold">{cleanTitle(course.title)}</h3>
			<dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-sm">
				<dt className="text-muted-foreground">Кафедра</dt>
				<dd>{cleanTitle(course.department)}</dd>
				<dt className="text-muted-foreground">Оцінки</dt>
				<dd>{ratingsText(course.ratings)}</dd>
				<dt className="text-muted-foreground">Семестри</dt>
				<dd>{countWith(course.offerings.length, SEMESTERS)}</dd>
			</dl>
			<ul className="flex flex-wrap gap-1.5 text-sm">
				{chips.shown.map((chip) => (
					<li key={chip} className="rounded-md border px-2 py-0.5 tabular-nums">
						{chip}
					</li>
				))}
				{chips.more > 0 ? (
					<li className="px-1 py-0.5 text-muted-foreground">
						і ще {chips.more}
					</li>
				) : null}
			</ul>
			<a
				href={course.url}
				target="_blank"
				rel="noreferrer"
				className="mt-auto inline-flex items-center gap-1 text-sm text-primary hover:underline"
			>
				Відкрити сторінку <ArrowUpRight className="size-3.5" />
			</a>
		</article>
	);
}

function PairDesk({
	question,
	answer,
	onAnswer,
	onLater,
}: Readonly<{
	question: SyncQuestion;
	answer: DeskAnswer | undefined;
	onAnswer: (value: DeskAnswer) => void;
	onLater: () => void;
}>) {
	const [keepId, setKeepId] = useState<string | null>(
		answer?.answer === "merge" ? answer.into : null,
	);
	const pair = deskPair(question, keepId);
	useDeskKeys(
		{
			"1": () => pair && onAnswer({ answer: "merge", into: pair.keep.id }),
			"2": () => onAnswer({ answer: "keep_apart", into: null }),
			ArrowRight: onLater,
		},
		pair !== null,
	);
	if (pair === null) {
		return null;
	}
	const other = pair.gone[0];
	return (
		<div className="space-y-5">
			<p className="max-w-3xl text-base">{mergeAsk(question)}</p>
			<div className="grid gap-4 md:grid-cols-2">
				<PageCard course={pair.keep} stays />
				{pair.gone.map((course) => (
					<PageCard key={course.id} course={course} stays={false} />
				))}
			</div>
			<p className="text-sm text-muted-foreground">
				{keepReason(question, pair.keep)}{" "}
				{other ? (
					<button
						type="button"
						className="text-primary hover:underline"
						onClick={() => setKeepId(other.id)}
					>
						Залишити іншу
					</button>
				) : null}
			</p>
			<DataOutcome title="Якщо об'єднати:">{mergeOutcome(pair)}</DataOutcome>
			{answerText(answer) === null ? null : (
				<p className="text-sm font-medium" role="status">
					{answerText(answer)}
				</p>
			)}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<Button
					size="lg"
					onClick={() => onAnswer({ answer: "merge", into: pair.keep.id })}
				>
					Об'єднати <Kbd>1</Kbd>
				</Button>
				<Button
					size="lg"
					variant="outline"
					onClick={() => onAnswer({ answer: "keep_apart", into: null })}
				>
					Залишити окремо <Kbd>2</Kbd>
				</Button>
				<LaterButton onLater={onLater} />
			</div>
		</div>
	);
}

export function SyncMergeDesk({
	onBack,
	onConfirm,
}: Readonly<{
	onBack: () => void;
	onConfirm: (request: ConfirmRequest) => void;
}>) {
	const questions = useSyncQuestions({ kinds: "merge_courses", rated: true });
	const items = questions.data ?? [];
	const { answers, answer: saveAnswer, save } = useDeskAnswers(items);
	const [index, setIndex] = useState<number | null>(null);
	const current = index ?? firstOpen(items, answers);
	const question = items[current];
	const merged = idsAnswered(answers, new Set(["merge"]));
	const apart = idsAnswered(answers, new Set(["keep_apart"]));
	const answer = (value: DeskAnswer) => {
		if (question === undefined) {
			return;
		}
		saveAnswer(question.id, value, () =>
			setIndex(nextIndex(current, items.length)),
		);
	};
	return (
		<div className="space-y-5">
			<DataBack onBack={onBack}>Усі групи</DataBack>
			<DeskHead
				title="Схожі на дублікати"
				progress={deskProgress(current, items.length)}
				label={`Пара ${progressLabel(current, items.length, " з оцінками")}`}
			/>
			{questions.isLoading ? <DataTableSkeleton /> : null}
			{questions.error ? (
				<UkmaDataError
					error={questions.error}
					title="Не вдалося завантажити пари"
					onRetry={() => void questions.refetch()}
					isRetrying={questions.isRefetching}
				/>
			) : null}
			{questions.data && items.length === 0 ? (
				<DataTableEmpty>Пар з оцінками не залишилось</DataTableEmpty>
			) : null}
			{question ? (
				<PairDesk
					key={question.id}
					question={question}
					answer={answers.get(question.id)}
					onAnswer={answer}
					onLater={() => setIndex(nextIndex(current, items.length))}
				/>
			) : null}
			{save.isError ? (
				<p role="alert" className="text-sm text-destructive">
					Не вдалося зберегти рішення. Спробуйте ще раз.
				</p>
			) : null}
			{items.length > 0 ? (
				<DecisionsBar
					count={merged.length + apart.length}
					onApply={() => onConfirm(mergeDecisionsRequest(merged, apart))}
				/>
			) : null}
		</div>
	);
}

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import type { SyncQuestion } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import { useDeskAnswers } from "../hooks/useDeskAnswers";
import { useSyncQuestions } from "../hooks/useSyncQuestions";
import type { ConfirmRequest } from "../syncConfirm";
import {
	deskProgress,
	firstOpen,
	idsAnswered,
	nextIndex,
	PLACE_OUTCOME,
	placeAsk,
	placeOptions,
	progressLabel,
} from "../syncDesk";
import type { DeskAnswer } from "../syncDesk";
import { placeDecisionsRequest } from "../syncRequests";
import { cleanTitle, ratingsText } from "../syncWords";
import { SyncBack, SyncOutcome } from "./SyncBits";
import {
	DecisionsBar,
	DeskHead,
	LaterButton,
	useDeskKeys,
} from "./SyncDeskBits";
import { SyncTableEmpty, SyncTableSkeleton } from "./SyncTable";
import { UkmaDataError } from "./UkmaDataError";

const NONE = "none";

function Choice({
	name,
	value,
	checked,
	onChange,
	title,
	detail,
	aside,
}: Readonly<{
	name: string;
	value: string;
	checked: boolean;
	onChange: (value: string) => void;
	title: string;
	detail: string;
	aside?: string;
}>) {
	return (
		<label
			className={cn(
				"flex cursor-pointer items-center gap-4 px-5 py-4",
				checked && "bg-tint-primary",
			)}
		>
			<input
				type="radio"
				name={name}
				value={value}
				checked={checked}
				onChange={() => onChange(value)}
				className="size-4 shrink-0 accent-primary"
			/>
			<span className="min-w-0 flex-1">
				<span className="block">{title}</span>
				<span className="block text-sm text-muted-foreground">{detail}</span>
			</span>
			{aside ? (
				<span className="shrink-0 text-sm text-muted-foreground">{aside}</span>
			) : null}
		</label>
	);
}

function PlaceQuestion({
	question,
	onAnswer,
	onLater,
}: Readonly<{
	question: SyncQuestion;
	onAnswer: (value: DeskAnswer) => void;
	onLater: () => void;
}>) {
	const [chosen, setChosen] = useState<string | null>(null);
	const options = placeOptions(question);
	useDeskKeys({ ArrowRight: onLater }, true);
	const attach = () => {
		if (chosen === NONE) {
			onAnswer({ answer: "none", into: null });
			return;
		}
		const option = options.find((item) => item.course.id === chosen);
		if (option !== undefined) {
			onAnswer({ answer: option.answer, into: option.into });
		}
	};
	const name = `place-${question.id}`;
	return (
		<div className="space-y-5">
			<p className="max-w-3xl text-base">{placeAsk(question)}</p>
			<fieldset className="divide-y overflow-hidden rounded-xl border bg-card">
				<legend className="sr-only">Дисципліна для семестру</legend>
				{options.map((option) => (
					<Choice
						key={option.course.id}
						name={name}
						value={option.course.id}
						checked={chosen === option.course.id}
						onChange={setChosen}
						title={cleanTitle(option.course.title)}
						detail={cleanTitle(option.course.department)}
						aside={ratingsText(option.course.ratings)}
					/>
				))}
				<Choice
					name={name}
					value={NONE}
					checked={chosen === NONE}
					onChange={setChosen}
					title="Жодна не підходить"
					detail="Семестр не з'явиться на сайті; питання повернеться, якщо в САЗ щось зміниться"
				/>
			</fieldset>
			<SyncOutcome title="Що буде:">{PLACE_OUTCOME}</SyncOutcome>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<Button size="lg" disabled={chosen === null} onClick={attach}>
					Прикріпити
				</Button>
				<LaterButton onLater={onLater} />
			</div>
		</div>
	);
}

export function SyncPlaceDesk({
	onBack,
	onConfirm,
}: Readonly<{
	onBack: () => void;
	onConfirm: (request: ConfirmRequest) => void;
}>) {
	const questions = useSyncQuestions({
		kinds: "place_offering,move_offering",
	});
	const items = questions.data ?? [];
	const { answers, answer: saveAnswer, save } = useDeskAnswers(items);
	const [index, setIndex] = useState<number | null>(null);
	const current = index ?? firstOpen(items, answers);
	const question = items[current];
	const placed = idsAnswered(answers, new Set(["place", "keep", "move"]));
	const none = idsAnswered(answers, new Set([NONE]));
	const answer = (value: DeskAnswer) => {
		if (question === undefined) {
			return;
		}
		saveAnswer(question.id, value, () =>
			setIndex(nextIndex(current, items.length)),
		);
	};
	const count = placed.length + none.length;
	return (
		<div className="space-y-5">
			<SyncBack onBack={onBack} />
			<DeskHead
				title="Семестр без дисципліни"
				progress={deskProgress(current, items.length)}
				label={progressLabel(current, items.length, "")}
			/>
			{questions.isLoading ? <SyncTableSkeleton /> : null}
			{questions.error ? (
				<UkmaDataError
					error={questions.error}
					title="Не вдалося завантажити семестри"
					onRetry={() => void questions.refetch()}
					isRetrying={questions.isRefetching}
				/>
			) : null}
			{questions.data && items.length === 0 ? (
				<SyncTableEmpty>Семестрів без дисципліни не залишилось</SyncTableEmpty>
			) : null}
			{question ? (
				<PlaceQuestion
					key={question.id}
					question={question}
					onAnswer={answer}
					onLater={() => setIndex(nextIndex(current, items.length))}
				/>
			) : null}
			{save.isError ? (
				<p role="alert" className="text-sm text-destructive">
					Не вдалося зберегти рішення. Спробуйте ще раз.
				</p>
			) : null}
			{count > 0 ? (
				<DecisionsBar
					count={count}
					onApply={() => onConfirm(placeDecisionsRequest(placed, none))}
				/>
			) : null}
		</div>
	);
}

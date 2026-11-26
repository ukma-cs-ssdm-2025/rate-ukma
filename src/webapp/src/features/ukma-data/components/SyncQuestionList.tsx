import { useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/Button";

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import type { AnswerEnum, SyncQuestion } from "@/lib/api/generated";
import {
	useUkmaDataSyncQuestionAnswer,
	useUkmaDataSyncQuestionsList,
} from "@/lib/api/generated";
import { kindLabel } from "../sync";
import { actionFailure } from "../syncActions";
import { invalidateSyncQueries } from "../syncQueries";
import { ApplyAnswers, SettleUnrated } from "./SyncQuestionActions";
import { countWith, RATINGS } from "../syncFormat";
import { NO_RETRY } from "../syncOverview";
import { Ago } from "./Term";
import { UkmaDataError } from "./UkmaDataError";

const SHOWN = 50;

function termWord(term: string): string | null {
	switch (term) {
		case "FALL":
			return "осінь";
		case "SPRING":
			return "весна";
		case "SUMMER":
			return "літо";
		default:
			return null;
	}
}

function offeringText(offering: SyncQuestion["offering"]): string {
	if (offering === null || offering === undefined) {
		return "";
	}
	const term = termWord(offering.term);
	return term === null ? `, ${offering.year}` : `, ${term} ${offering.year}`;
}

const ANSWER_WORDS = {
	merge: "об'єднати",
	keep_apart: "лишити окремо",
	keep: "лишити як є",
	move: "перенести",
	place: "прикріпити",
	relink: "переприв'язати",
} satisfies Record<AnswerEnum, string>;

interface QuestionCopy {
	title: string;
	pick: AnswerEnum | null;
	pickLabel: string;
	other: AnswerEnum | null;
	otherLabel: string;
}

function questionText(kind: string): QuestionCopy {
	switch (kind) {
		case "merge_courses":
			return {
				title: "Це одна дисципліна?",
				pick: "merge",
				pickLabel: "Обʼєднати сюди",
				other: "keep_apart",
				otherLabel: "Лишити окремо",
			};
		case "move_offering":
			return {
				title: "Перенести семестр на іншу сторінку?",
				pick: null,
				pickLabel: "",
				other: "keep",
				otherLabel: "Залишити як є",
			};
		case "relink_course":
			return {
				title: "Звʼязати сторінку з іншою дисципліною САЗ?",
				pick: null,
				pickLabel: "",
				other: "keep",
				otherLabel: "Залишити як є",
			};
		case "place_offering":
			return {
				title: "До якої сторінки належить семестр?",
				pick: "place",
				pickLabel: "Прикріпити сюди",
				other: null,
				otherLabel: "",
			};
		default:
			return {
				title: kindLabel(kind),
				pick: null,
				pickLabel: "",
				other: null,
				otherLabel: "",
			};
	}
}

const DIRECT_ANSWER = {
	move_offering: { answer: "move", label: "Перенести" },
	relink_course: { answer: "relink", label: "Переприв'язати" },
} satisfies Record<string, { answer: AnswerEnum; label: string }>;

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
	action,
}: Readonly<{
	course: SyncQuestion["courses"][number];
	suggested: boolean;
	action: React.ReactNode;
}>) {
	const facts = [
		course.department,
		yearsText(course.years),
		course.ratings > 0 ? countWith(course.ratings, RATINGS) : "без оцінок",
	].filter((part) => part.length > 0);
	return (
		<div className="min-w-0 space-y-1 px-4 py-3 sm:px-5">
			<a
				href={course.url}
				className="font-medium break-words underline-offset-4 hover:underline"
			>
				{course.title}
			</a>
			<p className="text-sm text-muted-foreground">{facts.join(", ")}</p>
			{suggested ? (
				<p className="text-sm text-muted-foreground">Пропонуємо лишити цю</p>
			) : null}
			{action}
		</div>
	);
}

type Answer = { answer: AnswerEnum; into: string | null };

const sameAnswer = (question: SyncQuestion, answer: Answer): boolean =>
	question.answer?.answer === answer.answer &&
	(answer.into === null || question.answer.into === answer.into);

function QuestionCard({ question }: Readonly<{ question: SyncQuestion }>) {
	const queryClient = useQueryClient();
	const [error, setError] = useState<string | null>(null);
	const [note, setNote] = useState<string | null>(null);
	const answer = useUkmaDataSyncQuestionAnswer({
		mutation: {
			onSuccess: (response) => {
				setError(null);
				setNote(response.detail);
			},
			onError: (failure) => setError(actionFailure(failure).text),
			onSettled: () => invalidateSyncQueries(queryClient),
		},
	});
	const copy = questionText(question.kind);
	const send = (choice: Answer) =>
		answer.mutate({
			changeId: question.id,
			data: { answer: choice.answer, into: choice.into },
		});
	const button = (choice: Answer, label: string) => {
		const chosen = sameAnswer(question, choice);
		return (
			<Button
				size="sm"
				variant={chosen ? "default" : "outline"}
				aria-pressed={chosen}
				disabled={answer.isPending}
				onClick={() => send(choice)}
			>
				{label}
			</Button>
		);
	};
	const direct =
		question.kind === "move_offering" || question.kind === "relink_course"
			? DIRECT_ANSWER[question.kind]
			: null;
	return (
		<div className="overflow-hidden rounded-xl border bg-card">
			<div className="space-y-1 px-4 py-3 sm:px-5">
				<h3 className="font-medium">{copy.title}</h3>
				{question.ukma_title ? (
					<p className="text-sm text-muted-foreground">
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
						action={
							copy.pick === null ? null : (
								<div className="pt-1">
									{button(
										{ answer: copy.pick, into: course.id },
										copy.pickLabel,
									)}
								</div>
							)
						}
					/>
				))}
			</div>
			<div className="space-y-2 border-t px-4 py-3 text-sm sm:px-5">
				{direct !== null || copy.other !== null ? (
					<div className="flex flex-wrap gap-2">
						{direct === null
							? null
							: button({ answer: direct.answer, into: null }, direct.label)}
						{copy.other === null
							? null
							: button({ answer: copy.other, into: null }, copy.otherLabel)}
					</div>
				) : null}
				<p className="text-muted-foreground" aria-live="polite">
					{note ??
						(question.answer === null ? (
							"Відповіді ще немає."
						) : (
							<>
								Відповідь: {ANSWER_WORDS[question.answer.answer]},{" "}
								<Ago iso={question.answer.decided_at} />.
							</>
						))}
				</p>
				{error === null ? null : (
					<p role="alert" className="text-destructive">
						{error}
					</p>
				)}
			</div>
		</div>
	);
}

export function SyncQuestionList() {
	const questions = useUkmaDataSyncQuestionsList({ limit: SHOWN }, NO_RETRY);
	if (questions.isLoading) {
		return <Skeleton className="h-64 rounded-xl" />;
	}
	if (questions.error) {
		return (
			<UkmaDataError
				error={questions.error}
				title="Не вдалося завантажити питання"
				onRetry={() => void questions.refetch()}
				isRetrying={questions.isRefetching}
			/>
		);
	}
	const items = questions.data?.items ?? [];
	if (items.length === 0) {
		return (
			<Empty className="border">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<HelpCircle />
					</EmptyMedia>
					<EmptyTitle>Питань немає</EmptyTitle>
					<EmptyDescription>
						САЗ і сайт групують дисципліни однаково.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}
	return (
		<>
			<SettleUnrated />
			<ul className="space-y-3" aria-label="Питання">
				{items.map((question) => (
					<li key={question.id}>
						<QuestionCard question={question} />
					</li>
				))}
			</ul>
			{questions.data?.next_after ? (
				<p className="text-sm text-muted-foreground">
					Показано перші {SHOWN}: спершу без відповіді, потім з найбільшою
					кількістю оцінок. Решта зʼявиться тут, коли ці отримають відповідь.
				</p>
			) : null}
			<ApplyAnswers />
		</>
	);
}

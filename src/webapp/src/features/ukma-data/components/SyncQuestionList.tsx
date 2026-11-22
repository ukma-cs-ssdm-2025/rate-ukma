import { HelpCircle } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import type { AnswerEnum, SyncQuestion } from "@/lib/api/generated";
import { useUkmaDataSyncQuestionsList } from "@/lib/api/generated";
import { kindLabel } from "../sync";
import { countWith, RATINGS } from "../syncFormat";
import { NO_RETRY } from "../syncOverview";
import { Ago } from "./Term";
import { UkmaDataError } from "./UkmaDataError";

const SHOWN = 50;

const ANSWER_WORDS = {
	merge: "об'єднати",
	keep_apart: "лишити окремо",
	keep: "лишити як є",
	move: "перенести",
	place: "прикріпити",
	relink: "переприв'язати",
} satisfies Record<AnswerEnum, string>;

function QuestionCard({ question }: Readonly<{ question: SyncQuestion }>) {
	return (
		<Card className="space-y-3 p-4">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="outline" className="tabular-nums">
					#{question.id}
				</Badge>
				<Badge variant="soft">{kindLabel(question.kind)}</Badge>
				<Badge variant="secondary">
					{question.ratings > 0
						? countWith(question.ratings, RATINGS)
						: "без оцінок"}
				</Badge>
			</div>
			{question.ukma_title ? (
				<p className="font-medium break-words">
					У САЗ: «{question.ukma_title}»
					{question.ukma_department ? `, ${question.ukma_department}` : ""}
				</p>
			) : null}
			{question.offering ? (
				<p className="text-sm text-muted-foreground">
					Курс у семестрі: САЗ {question.offering.saz_code},{" "}
					{question.offering.year}
				</p>
			) : null}
			<ul className="space-y-1 text-sm" aria-label="Курси на сайті">
				{question.courses.map((course) => (
					<li key={course.id} className="break-words">
						На сайті: «{course.title}», {course.department} ·{" "}
						{countWith(course.ratings, RATINGS)}
						{course.id === question.suggested_into ? (
							<span className="text-muted-foreground">
								{" "}
								· пропонуємо лишити цей
							</span>
						) : null}
					</li>
				))}
			</ul>
			<p className="text-sm text-muted-foreground">
				{question.answer === null ? (
					"Відповіді ще немає."
				) : (
					<>
						Відповідь: {ANSWER_WORDS[question.answer.answer]},{" "}
						<Ago iso={question.answer.decided_at} />.
					</>
				)}
			</p>
		</Card>
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
						САЗ і сайт групують курси однаково.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}
	return (
		<>
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
					кількістю оцінок. Решту покаже консоль.
				</p>
			) : null}
		</>
	);
}

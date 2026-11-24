import { HelpCircle } from "lucide-react";

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

interface QuestionCopy {
	title: string;
	answers: string;
}

function questionText(kind: string): QuestionCopy {
	switch (kind) {
		case "merge_courses":
			return {
				title: "Це одна дисципліна?",
				answers: "keep_apart або merge --into <id>",
			};
		case "move_offering":
			return {
				title: "Перенести семестр на іншу сторінку?",
				answers: "keep або move",
			};
		case "relink_course":
			return {
				title: "Звʼязати сторінку з іншим курсом САЗ?",
				answers: "keep або relink",
			};
		case "place_offering":
			return {
				title: "До якої сторінки належить семестр?",
				answers: "place --into <id>",
			};
		default:
			return { title: kindLabel(kind), answers: "" };
	}
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
}: Readonly<{ course: SyncQuestion["courses"][number]; suggested: boolean }>) {
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
		</div>
	);
}

function QuestionCard({ question }: Readonly<{ question: SyncQuestion }>) {
	return (
		<div className="overflow-hidden rounded-xl border bg-card">
			<div className="space-y-1 px-4 py-3 sm:px-5">
				<h3 className="font-medium">{questionText(question.kind).title}</h3>
				{question.ukma_title ? (
					<p className="text-sm text-muted-foreground">
						У САЗ: {question.ukma_title}
						{question.ukma_department ? `, ${question.ukma_department}` : ""}
						{question.offering ? `, семестр ${question.offering.year}` : ""}
					</p>
				) : null}
			</div>
			<div className="grid divide-y border-t sm:grid-flow-col sm:auto-cols-fr sm:divide-x sm:divide-y-0">
				{question.courses.map((course) => (
					<CourseColumn
						key={course.id}
						course={course}
						suggested={course.id === question.suggested_into}
					/>
				))}
			</div>
			<p className="border-t px-4 py-3 text-sm text-muted-foreground sm:px-5">
				{question.answer === null ? (
					<>
						Відповідь у консолі:{" "}
						<code className="break-all">
							catalog_sync answer {question.id}{" "}
							{questionText(question.kind).answers}
						</code>
					</>
				) : (
					<>
						Відповідь: {ANSWER_WORDS[question.answer.answer]},{" "}
						<Ago iso={question.answer.decided_at} />.
					</>
				)}
			</p>
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

import { ChevronDown, Inbox } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import type { SyncSummary, SyncSummaryAnswers } from "@/lib/api/generated";
import { useUkmaDataSyncRunApprovalsList } from "@/lib/api/generated";
import { formatCount } from "../syncFormat";
import { ANSWER_LABELS } from "../syncLabels";
import {
	answersTotal,
	isReviewStep,
	ANSWER_KEYS,
	latestApplied,
	summaryTotal,
} from "../syncReview";
import { skipReasonLabel } from "../syncReasons";
import type { ReviewStep } from "../syncReview";
import { SyncStepRow } from "./SyncStepRow";

function AnswersRow({
	answers,
	onOpen,
}: Readonly<{ answers: SyncSummaryAnswers; onOpen: () => void }>) {
	const parts = ANSWER_KEYS.flatMap((key) =>
		answers[key] > 0
			? [`${formatCount(answers[key])} ${ANSWER_LABELS[key]}`]
			: [],
	);
	const tomorrow = answers.place > 0 || answers.move > 0;
	return (
		<section
			aria-label="Ваші відповіді"
			className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
		>
			<div className="space-y-1">
				<p className="text-sm tabular-nums">
					<span className="font-medium">Ваші відповіді:</span>{" "}
					{parts.join(" · ")}
				</p>
				{tomorrow ? (
					<p className="text-xs text-muted-foreground">
						Відповіді про курси в семестрі зʼявляться у завтрашньому запуску.
					</p>
				) : null}
			</div>
			<Button className="w-full sm:w-auto" onClick={onOpen}>
				Переглянути й застосувати
			</Button>
		</section>
	);
}

function NotProposed({ summary }: Readonly<{ summary: SyncSummary }>) {
	const entries = Object.entries(summary.not_proposed).filter(
		([, value]) => value.count > 0,
	);
	if (entries.length === 0) {
		return null;
	}
	const total = entries.reduce((sum, [, value]) => sum + value.count, 0);
	return (
		<Collapsible className="rounded-lg border p-3">
			<CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 rounded-md text-left text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
				<span>
					<span className="font-medium">Не запропоновано:</span>{" "}
					<span className="tabular-nums">{formatCount(total)}</span>
				</span>
				<ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<ul
					className="mt-3 space-y-1.5 text-sm"
					aria-label="Не запропоновано за причиною"
				>
					{entries.map(([reason, value]) => (
						<li
							key={reason}
							className="flex flex-wrap items-center justify-between gap-2"
						>
							<span>{skipReasonLabel(reason)}</span>
							<span className="flex items-center gap-2 tabular-nums">
								{formatCount(value.count)}
								{value.rated > 0 ? (
									<Badge variant="caution">
										з оцінками: {formatCount(value.rated)}
									</Badge>
								) : null}
							</span>
						</li>
					))}
				</ul>
			</CollapsibleContent>
		</Collapsible>
	);
}

export function SyncOverview({
	summary,
	onOpenStep,
	onOpenAnswers,
}: Readonly<{
	summary: SyncSummary;
	onOpenStep: (step: ReviewStep) => void;
	onOpenAnswers: () => void;
}>) {
	const approvals = useUkmaDataSyncRunApprovalsList(
		summary.run.id,
		{ page_size: 100 },
		{ query: { retry: false } },
	);
	const items = approvals.data?.items ?? [];
	const total = summaryTotal(summary);
	const answers = answersTotal(summary);
	if (total === 0 && answers === 0) {
		return (
			<div className="space-y-4">
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Inbox />
						</EmptyMedia>
						<EmptyTitle>Нічого не чекає</EmptyTitle>
						<EmptyDescription>
							Наступний запуск каталогу о 02:30, викладачів о 02:00.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
				<NotProposed summary={summary} />
			</div>
		);
	}
	const steps = summary.steps.flatMap((item) =>
		isReviewStep(item.step) ? [{ step: item.step, item }] : [],
	);
	const firstOpen = steps.find(({ item }) => item.count > 0)?.step;
	return (
		<div className="space-y-4">
			<section aria-labelledby="sync-path" className="space-y-2">
				<h2 id="sync-path" className="text-base font-semibold">
					Порядок роботи
				</h2>
				<ol className="space-y-2" aria-label="Порядок роботи">
					{steps.map(({ step, item }, index) => (
						<SyncStepRow
							key={step}
							number={index + 1}
							step={step}
							summary={item}
							primary={step === firstOpen}
							applied={latestApplied(items, item.group)}
							onOpen={() => onOpenStep(step)}
						/>
					))}
				</ol>
			</section>
			{answers > 0 ? (
				<AnswersRow answers={summary.answers} onOpen={onOpenAnswers} />
			) : null}
			<NotProposed summary={summary} />
		</div>
	);
}

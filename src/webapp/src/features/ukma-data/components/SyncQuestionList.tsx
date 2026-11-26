import { HelpCircle } from "lucide-react";

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import {
	useUkmaDataSyncQuestionsList,
	useUkmaDataSyncSummary,
} from "@/lib/api/generated";
import { NO_RETRY } from "../syncOverview";
import { pendingApplyIds } from "../syncQuestions";
import { SyncApplyBar } from "./SyncApplyBar";
import { SyncQuestionCard } from "./SyncQuestionCard";
import { UkmaDataError } from "./UkmaDataError";

const SHOWN = 50;

export function SyncQuestionList() {
	const questions = useUkmaDataSyncQuestionsList({ limit: SHOWN }, NO_RETRY);
	const summary = useUkmaDataSyncSummary({ source: "catalog" }, NO_RETRY);
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
	const toApply = pendingApplyIds(items);
	const runId = summary.data?.run.id ?? null;
	return (
		<div className="space-y-3">
			<ul className="space-y-3" aria-label="Питання">
				{items.map((question) => (
					<li key={question.id}>
						<SyncQuestionCard question={question} />
					</li>
				))}
			</ul>
			{questions.data?.next_after ? (
				<p className="text-sm text-muted-foreground">
					Показано перші {SHOWN}: спершу без відповіді, потім з найбільшою
					кількістю оцінок. Наступні зʼявляться, коли ви відповісте на ці.
				</p>
			) : null}
			{toApply.length > 0 ? (
				<SyncApplyBar
					selection={{ source: "catalog", run: runId, change_ids: toApply }}
					runId={runId}
					selected={toApply.length}
					total={toApply.length}
					onDecided={() => undefined}
				/>
			) : null}
		</div>
	);
}

import { useState } from "react";

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { SectionHeader } from "@/components/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { CaseEvidence } from "@/features/ukma-data/components/CaseEvidence";
import { DecisionActions } from "@/features/ukma-data/components/DecisionActions";
import { DecisionTrail } from "@/features/ukma-data/components/DecisionTrail";
import {
	useDecisions,
	useReviewCase,
} from "@/features/ukma-data/hooks/useUkmaData";
import {
	CASE_KIND_LABELS,
	CASE_STATUS_LABELS,
	caseTitle,
	formatDateTime,
	SAFE_ANSWER_LABELS,
} from "@/features/ukma-data/reviewCases";

function ReviewCaseDetail() {
	const { caseId } = Route.useParams();
	const caseQuery = useReviewCase(caseId);
	const decisionsQuery = useDecisions({ reviewCaseId: caseId });
	const [instructorId, setInstructorId] = useState<string | null>(null);
	const reviewCase = caseQuery.data;
	const decisions = decisionsQuery.data ?? [];

	if (caseQuery.isLoading) return <Skeleton className="h-96 rounded-xl" />;
	if (!reviewCase) {
		return (
			<ErrorState
				title="Справу не знайдено"
				description="Можливо, її вже закрив новий запуск."
			/>
		);
	}

	return (
		<div className="space-y-6">
			<Link
				to="/data/cases"
				className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<ArrowLeft className="size-4" />
				Усі справи
			</Link>
			<div className="space-y-2">
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="soft">{CASE_KIND_LABELS[reviewCase.kind]}</Badge>
					<Badge variant="outline">
						{CASE_STATUS_LABELS[reviewCase.status]}
					</Badge>
				</div>
				<h2 className="text-xl font-semibold break-words">
					{caseTitle(reviewCase)}
				</h2>
				<p className="text-sm text-muted-foreground">
					Відкрито {formatDateTime(reviewCase.openedAt)}, запуск №
					{reviewCase.runId}.
					{reviewCase.status === "open"
						? ` Зараз опубліковано: ${SAFE_ANSWER_LABELS[reviewCase.kind]}.`
						: null}
				</p>
			</div>
			<CaseEvidence
				reviewCase={reviewCase}
				selectedInstructorId={instructorId}
				onSelectInstructor={setInstructorId}
			/>
			<DecisionActions
				reviewCase={reviewCase}
				decision={decisions.find((item) => item.id === reviewCase.decisionId)}
				selectedInstructorId={instructorId}
			/>
			<section className="space-y-3">
				<SectionHeader title="Рішення у справі" />
				<DecisionTrail decisions={decisions} />
			</section>
		</div>
	);
}

export const Route = createFileRoute("/data/cases/$caseId")({
	component: ReviewCaseDetail,
});

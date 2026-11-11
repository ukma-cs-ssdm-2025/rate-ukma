import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, SearchX } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { CaseDetails } from "@/features/ukma-data/components/CaseDetails";
import { UkmaDataError } from "@/features/ukma-data/components/UkmaDataError";
import {
	kindLabel,
	NO_RETRY,
	PAGE,
	SAFE_ANSWER_LABELS,
	statusLabel,
} from "@/features/ukma-data/reviewCases";
import { useUkmaDataReviewCasesList } from "@/lib/api/generated";

// The proxy has no single-case route, so the page reads the list's cached page.
function ReviewCaseDetail() {
	const { caseId } = Route.useParams();
	const { data, isLoading, error, refetch, isRefetching } =
		useUkmaDataReviewCasesList(PAGE, NO_RETRY);

	if (isLoading) return <Skeleton className="h-96 rounded-xl" />;
	if (!data) {
		return (
			<UkmaDataError
				error={error}
				title="Не вдалося відкрити справу"
				onRetry={refetch}
				isRetrying={isRefetching}
			/>
		);
	}
	const reviewCase = data.items?.find((item) => item.id === caseId);
	if (!reviewCase) {
		return (
			<ErrorState
				icon={SearchX}
				title="Справи не знайдено"
				description={
					data.has_more
						? `Шукали серед перших ${PAGE.limit} справ.`
						: "UKMA Data не має такої справи."
				}
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
					<Badge variant="soft">{kindLabel(reviewCase.kind)}</Badge>
					<Badge variant="outline">{statusLabel(reviewCase.status)}</Badge>
				</div>
				<h2 className="text-xl font-semibold break-words">
					Справа {reviewCase.id}
				</h2>
				{reviewCase.status === "open" && reviewCase.kind ? (
					<p className="text-sm text-muted-foreground">
						Поки справа відкрита, опубліковано безпечну відповідь:{" "}
						{SAFE_ANSWER_LABELS[reviewCase.kind]}.
					</p>
				) : null}
			</div>
			<CaseDetails reviewCase={reviewCase} />
			<p className="text-sm text-muted-foreground">
				Ухвалити рішення з Rate UKMA поки не можна: тут лише перегляд.
			</p>
		</div>
	);
}

export const Route = createFileRoute("/data/cases/$caseId")({
	component: ReviewCaseDetail,
});

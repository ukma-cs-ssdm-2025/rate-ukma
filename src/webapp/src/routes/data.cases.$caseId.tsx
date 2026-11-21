import { createFileRoute } from "@tanstack/react-router";

import { ReviewCasePage } from "@/features/ukma-data/components/ReviewCasePage";

function ReviewCaseRoute() {
	const { caseId } = Route.useParams();
	return <ReviewCasePage caseId={caseId} />;
}

export const Route = createFileRoute("/data/cases/$caseId")({
	component: ReviewCaseRoute,
});

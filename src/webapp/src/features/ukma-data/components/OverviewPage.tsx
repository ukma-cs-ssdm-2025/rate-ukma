import { OverviewPanel, OverviewPanelSkeleton } from "./OverviewPanel";
import { UkmaDataError } from "./UkmaDataError";
import { NO_RETRY } from "../reviewCases";
import { useUkmaDataStatusRetrieve } from "@/lib/api/generated";

export function OverviewPage() {
	const { data, isLoading, error, refetch, isRefetching } =
		useUkmaDataStatusRetrieve(NO_RETRY);
	if (isLoading) {
		return <OverviewPanelSkeleton />;
	}
	if (error || !data) {
		return (
			<UkmaDataError
				error={error}
				title="Не вдалося завантажити огляд"
				onRetry={refetch}
				isRetrying={isRefetching}
			/>
		);
	}
	return <OverviewPanel status={data} />;
}

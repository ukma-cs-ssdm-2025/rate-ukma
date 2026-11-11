import { createFileRoute } from "@tanstack/react-router";

import {
	OverviewPanel,
	OverviewPanelSkeleton,
} from "@/features/ukma-data/components/OverviewPanel";
import { UkmaDataError } from "@/features/ukma-data/components/UkmaDataError";
import { NO_RETRY } from "@/features/ukma-data/reviewCases";
import { useUkmaDataStatusRetrieve } from "@/lib/api/generated";

function DataOverview() {
	const { data, isLoading, error, refetch, isRefetching } =
		useUkmaDataStatusRetrieve(NO_RETRY);
	if (isLoading) return <OverviewPanelSkeleton />;
	if (!data) {
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

export const Route = createFileRoute("/data/")({
	component: DataOverview,
});

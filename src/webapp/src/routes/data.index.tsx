import { createFileRoute } from "@tanstack/react-router";

import { ErrorState } from "@/components/ui/ErrorState";
import {
	OverviewPanel,
	OverviewPanelSkeleton,
} from "@/features/ukma-data/components/OverviewPanel";
import { useUkmaDataOverview } from "@/features/ukma-data/hooks/useUkmaData";

function DataOverview() {
	const { data, isLoading, isError, refetch, isRefetching } =
		useUkmaDataOverview();
	if (isLoading) return <OverviewPanelSkeleton />;
	if (isError || !data) {
		return (
			<ErrorState
				title="Не вдалося завантажити огляд"
				onRetry={refetch}
				isRetrying={isRefetching}
			/>
		);
	}
	return <OverviewPanel data={data} />;
}

export const Route = createFileRoute("/data/")({
	component: DataOverview,
});

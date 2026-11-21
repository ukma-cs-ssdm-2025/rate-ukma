import { createFileRoute } from "@tanstack/react-router";

import { OverviewPage } from "@/features/ukma-data/components/OverviewPage";

export const Route = createFileRoute("/data/")({
	component: OverviewPage,
});

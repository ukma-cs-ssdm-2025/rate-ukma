import { createFileRoute } from "@tanstack/react-router";

import { SyncReviewPage } from "@/features/ukma-data/components/SyncReviewPage";

export const Route = createFileRoute("/data/sync_/preview")({
	component: SyncReviewPage,
});

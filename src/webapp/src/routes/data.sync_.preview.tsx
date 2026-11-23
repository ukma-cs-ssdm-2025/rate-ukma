import { createFileRoute } from "@tanstack/react-router";

import { SyncPreviewPage } from "@/features/ukma-data/components/SyncPreviewPage";

export const Route = createFileRoute("/data/sync_/preview")({
	component: SyncPreviewPage,
});

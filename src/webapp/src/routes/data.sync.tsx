import { createFileRoute } from "@tanstack/react-router";

import { SyncPage } from "@/features/ukma-data/components/SyncPage";

export const Route = createFileRoute("/data/sync")({
	component: SyncPage,
});

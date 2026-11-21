import { createFileRoute } from "@tanstack/react-router";

import { ReviewCasesPage } from "@/features/ukma-data/components/ReviewCasesPage";

export const Route = createFileRoute("/data/cases/")({
	component: ReviewCasesPage,
});

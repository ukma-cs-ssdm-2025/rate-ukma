import { createFileRoute } from "@tanstack/react-router";

import { UkmaDataSection } from "@/features/ukma-data/components/UkmaDataSection";
import { withAuth } from "@/lib/auth";

export const Route = createFileRoute("/data")({
	component: withAuth(UkmaDataSection),
});

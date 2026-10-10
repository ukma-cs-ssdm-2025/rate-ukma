import { createFileRoute } from "@tanstack/react-router";

import { SchedulePage } from "@/features/schedule/components/SchedulePage";
import { withAuth } from "@/lib/auth";

export const Route = createFileRoute("/schedule")({
	component: withAuth(SchedulePage),
});

import { createFileRoute } from "@tanstack/react-router";

import { TeachingPage } from "@/features/teaching/components/TeachingPage";
import { withAuth } from "@/lib/auth";

export const Route = createFileRoute("/teaching")({
	component: withAuth(TeachingPage),
});

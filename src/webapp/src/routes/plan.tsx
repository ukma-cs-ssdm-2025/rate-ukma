import { createFileRoute } from "@tanstack/react-router";

import { PersonalPlanPage } from "@/features/personal-plan/components/PersonalPlanPage";
import { withAuth } from "@/lib/auth";

export const Route = createFileRoute("/plan")({
	component: withAuth(PersonalPlanPage),
});

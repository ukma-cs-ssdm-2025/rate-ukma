import { createFileRoute } from "@tanstack/react-router";

import { PersonalPlanPage } from "@/features/personal-plan/components/PersonalPlanPage";
import { withAuth } from "@/lib/auth/withAuth";

export const Route = createFileRoute("/plan")({
	component: withAuth(PersonalPlanPage),
});

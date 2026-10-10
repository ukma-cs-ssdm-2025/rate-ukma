import { createFileRoute } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import { SchedulePage } from "@/features/schedule/components/SchedulePage";
import { useAuth, withAuth } from "@/lib/auth";
import { useFeatureFlagState } from "@/lib/feature-flags";

function ScheduleRoute() {
	const { isStudent } = useAuth();
	const { enabled, isReady } = useFeatureFlagState("fe_schedule");
	// Stay blank until the flag resolves, so a disabled page never flashes in.
	if (!isReady) return null;
	if (!enabled || !isStudent) {
		return (
			<Layout>
				<p className="text-muted-foreground">Розклад поки недоступний.</p>
			</Layout>
		);
	}
	return <SchedulePage />;
}

export const Route = createFileRoute("/schedule")({
	component: withAuth(ScheduleRoute),
});

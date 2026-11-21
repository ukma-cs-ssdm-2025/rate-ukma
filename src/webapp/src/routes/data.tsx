import { createFileRoute, Outlet } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import {
	DataSectionHeader,
	StaffOnlyState,
} from "@/features/ukma-data/components/DataSectionHeader";
import { useAuth, withAuth } from "@/lib/auth";
import { useFeatureFlagState } from "@/lib/feature-flags";

function DataSection() {
	const { isSuperuser } = useAuth();
	const { enabled, isReady } = useFeatureFlagState("fe_ukma_data");

	if (!isReady) {
		return null;
	}
	if (!enabled) {
		return (
			<Layout>
				<p className="text-muted-foreground">Розділ наразі недоступний.</p>
			</Layout>
		);
	}

	return (
		<Layout>
			{isSuperuser ? (
				<div className="space-y-6">
					<DataSectionHeader />
					<Outlet />
				</div>
			) : (
				<StaffOnlyState />
			)}
		</Layout>
	);
}

export const Route = createFileRoute("/data")({
	component: withAuth(DataSection),
});

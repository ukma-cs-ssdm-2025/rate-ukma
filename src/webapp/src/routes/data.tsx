import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import {
	DataSectionHeader,
	StaffOnlyState,
} from "@/features/ukma-data/components/DataSectionHeader";
import { useAuth, withAuth } from "@/lib/auth";
import { useFeatureFlagState } from "@/lib/feature-flags";

// The browser only hides the section; the /api/v1/ukma-data/ proxy checks
// superuser on every call and holds the UKMA Data key. With the flag off the
// section is not found, whoever asks.
function DataSection() {
	const { isSuperuser } = useAuth();
	const { enabled, isReady } = useFeatureFlagState("fe_ukma_data");

	// Stay blank until the flag resolves, so a hidden section never flashes in.
	if (!isReady) return null;
	if (!enabled) throw notFound();

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

import { createFileRoute, Outlet } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import {
	DataSectionHeader,
	StaffOnlyState,
} from "@/features/ukma-data/components/DataSectionHeader";
import { useAuth, withAuth } from "@/lib/auth";

// The browser only hides the section; the /api/v1/ukma-data/ proxy checks
// superuser on every call and holds the UKMA Data key.
function DataSection() {
	const { isSuperuser } = useAuth();
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

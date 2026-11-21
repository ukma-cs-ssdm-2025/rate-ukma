import { Outlet } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import { DataSectionHeader, StaffOnlyState } from "./DataSectionHeader";
import { useAuth } from "@/lib/auth";
import { useFeatureFlagState } from "@/lib/feature-flags";

export function UkmaDataSection() {
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

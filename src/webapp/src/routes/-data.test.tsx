import type { ComponentType, ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAuth } from "@/lib/auth/useAuth";
import { FeatureFlagsContext } from "@/lib/feature-flags/FeatureFlagsContext";
import { Route } from "./data";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: object) => options,
	Outlet: () => <div data-testid="staff-outlet" />,
}));

vi.mock("@/components/Layout", () => ({
	default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/features/ukma-data/components/DataSectionHeader", async () => ({
	...(await vi.importActual(
		"@/features/ukma-data/components/DataSectionHeader",
	)),
	DataSectionHeader: () => null,
}));

vi.mock("@/lib/auth/withAuth", () => ({
	withAuth: <P extends object>(Component: ComponentType<P>) => Component,
}));

vi.mock("@/lib/auth/useAuth", () => ({
	useAuth: vi.fn(),
}));

const DataSection = (Route as unknown as { component: ComponentType })
	.component;

function renderAs(
	isSuperuser: boolean,
	{ flagOn = true, flagsReady = true } = {},
) {
	vi.mocked(useAuth).mockReturnValue({ isSuperuser } as ReturnType<
		typeof useAuth
	>);
	render(
		<FeatureFlagsContext.Provider
			value={{ flags: { fe_ukma_data: flagOn }, isReady: flagsReady }}
		>
			<DataSection />
		</FeatureFlagsContext.Provider>,
	);
}

describe("/data gate", () => {
	it("shows a signed-in non-superuser the superusers-only page", () => {
		renderAs(false);

		expect(
			screen.getByText("Розділ лише для суперкористувачів"),
		).toBeInTheDocument();
		expect(screen.queryByTestId("staff-outlet")).not.toBeInTheDocument();
	});

	it("opens the section for a superuser", () => {
		renderAs(true);

		expect(screen.getByTestId("staff-outlet")).toBeInTheDocument();
		expect(
			screen.queryByText("Розділ лише для суперкористувачів"),
		).not.toBeInTheDocument();
	});

	describe("fe_ukma_data flag", () => {
		it("is unavailable for a superuser while the flag is off", () => {
			renderAs(true, { flagOn: false });

			expect(
				screen.getByText("Розділ наразі недоступний."),
			).toBeInTheDocument();
			expect(screen.queryByTestId("staff-outlet")).not.toBeInTheDocument();
		});

		it("is unavailable, not superusers-only, for a non-superuser with the flag off", () => {
			renderAs(false, { flagOn: false });

			expect(
				screen.getByText("Розділ наразі недоступний."),
			).toBeInTheDocument();
			expect(
				screen.queryByText("Розділ лише для суперкористувачів"),
			).not.toBeInTheDocument();
		});

		it("shows nothing until the flags resolve", () => {
			renderAs(true, { flagOn: false, flagsReady: false });

			expect(screen.queryByTestId("staff-outlet")).not.toBeInTheDocument();
		});
	});
});

import type { ComponentType, ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/lib/auth";
import { FeatureFlagsContext } from "@/lib/feature-flags/FeatureFlagsContext";
import { Route } from "./data";

const NOT_FOUND = { isNotFound: true };

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: object) => options,
	notFound: () => NOT_FOUND,
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

vi.mock("@/lib/auth", () => ({
	withAuth: <P extends object>(Component: ComponentType<P>) => Component,
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
		// React logs the thrown not-found to the console before the boundary
		// catches it; the router's own boundary turns it into the 404 page.
		beforeEach(() => {
			vi.spyOn(console, "error").mockImplementation(() => undefined);
		});
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("is not found for a superuser while the flag is off", () => {
			expect(() => renderAs(true, { flagOn: false })).toThrow();
			expect(screen.queryByTestId("staff-outlet")).not.toBeInTheDocument();
		});

		it("is not found, not superusers-only, for a non-superuser with the flag off", () => {
			expect(() => renderAs(false, { flagOn: false })).toThrow();
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

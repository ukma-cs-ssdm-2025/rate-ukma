import type { ComponentType, ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAuth } from "@/lib/auth";
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

vi.mock("@/lib/auth", () => ({
	withAuth: <P extends object>(Component: ComponentType<P>) => Component,
	useAuth: vi.fn(),
}));

const DataSection = (Route as unknown as { component: ComponentType })
	.component;

function renderAs(isSuperuser: boolean) {
	vi.mocked(useAuth).mockReturnValue({ isSuperuser } as ReturnType<
		typeof useAuth
	>);
	render(<DataSection />);
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
});

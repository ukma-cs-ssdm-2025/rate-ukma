import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { FEED_FLAG } from "@/features/feed/feedFlags";
import { renderWithProviders, screen } from "@/test-utils/render";
import { FeedRoute } from "./feed";

vi.mock("@/components/Layout", () => ({
	default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@tanstack/react-router", async () => ({
	...(await vi.importActual("@tanstack/react-router")),
	Link: (await import("@/test-utils/router")).MockLink,
}));

describe("FeedRoute", () => {
	it("shows an unavailable message when the feed flag is off", () => {
		renderWithProviders(<FeedRoute />, { flags: { [FEED_FLAG]: false } });

		expect(screen.getByText("Стрічка наразі недоступна.")).toBeInTheDocument();
	});

	it("renders the heading and feed items when the flag is on", () => {
		renderWithProviders(<FeedRoute />, { flags: { [FEED_FLAG]: true } });

		expect(
			screen.getByRole("heading", { name: /Стрічка оновлень/ }),
		).toBeInTheDocument();
		expect(
			screen.getByText("Хакатон факультету інформатики"),
		).toBeInTheDocument();
		expect(
			screen.queryByText("Стрічка наразі недоступна."),
		).not.toBeInTheDocument();
	});
});

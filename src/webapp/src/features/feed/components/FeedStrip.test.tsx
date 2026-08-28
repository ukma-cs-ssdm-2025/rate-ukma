import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { FEED_FLAG } from "../feedFlags";
import { renderWithProviders, screen } from "@/test-utils/render";
import { FeedStrip } from "./FeedStrip";

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return {
		...actual,
		Link: ({
			to,
			children,
			className,
			...rest
		}: {
			to: string;
			children: ReactNode;
			className?: string;
		}) => (
			<a href={to} className={className} {...rest}>
				{children}
			</a>
		),
	};
});

describe("FeedStrip", () => {
	it("renders nothing when the feed flag is off", () => {
		renderWithProviders(<FeedStrip />, { flags: { [FEED_FLAG]: false } });

		expect(screen.queryByText("Стрічка оновлень")).not.toBeInTheDocument();
	});

	it("renders nothing until the flags have resolved", () => {
		renderWithProviders(<FeedStrip />, {
			flags: { [FEED_FLAG]: true },
			flagsReady: false,
		});

		expect(screen.queryByText("Стрічка оновлень")).not.toBeInTheDocument();
	});

	it("renders the feed and links to /feed when the flag is on", () => {
		renderWithProviders(<FeedStrip />, { flags: { [FEED_FLAG]: true } });

		expect(screen.getByText("Стрічка оновлень")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Уся стрічка/ })).toHaveAttribute(
			"href",
			"/feed",
		);
		expect(
			screen.getByRole("link", { name: /Переглянути всю стрічку/ }),
		).toHaveAttribute("href", "/feed");
	});

	it("orders pinned content ahead of unpinned content", () => {
		renderWithProviders(<FeedStrip />, { flags: { [FEED_FLAG]: true } });

		const pinned = screen.getByText("Хакатон факультету інформатики");
		const unpinned = screen.getByText("Реєстрація на вибіркові відкрита");

		// pinned promo (later by recency) should appear before the unpinned one.
		expect(
			pinned.compareDocumentPosition(unpinned) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});
});

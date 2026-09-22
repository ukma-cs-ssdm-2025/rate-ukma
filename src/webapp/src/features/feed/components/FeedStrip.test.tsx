import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
	fireEvent,
	renderWithProviders,
	screen,
	waitFor,
} from "@/test-utils/render";
import { FeedStrip } from "./FeedStrip";

vi.mock("@/features/feed/hooks/useFeed", async () => {
	const {
		createMockFeedPromoItem,
		createMockFeedReviewItem,
		createMockFeedState,
	} = await import("@/test-utils/factories");
	const feedState = createMockFeedState({
		items: [
			createMockFeedPromoItem({
				id: "p1",
				pinned: true,
				title: "Хакатон факультету інформатики",
				body: "48 годин, 12–14 вересня.",
			}),
			createMockFeedPromoItem({
				id: "p2",
				title: "Реєстрація на вибіркові відкрита",
				body: "До 20 вересня.",
			}),
			createMockFeedReviewItem({ id: "r1" }),
		],
	});
	return { useFeed: () => feedState };
});

vi.mock("@tanstack/react-router", async () => ({
	...(await vi.importActual("@tanstack/react-router")),
	Link: (await import("@/test-utils/router")).MockLink,
}));

describe("FeedStrip", () => {
	it("renders nothing when the feed flag is off", () => {
		renderWithProviders(<FeedStrip />, { flags: { fe_feed: false } });

		expect(screen.queryByText("Стрічка оновлень")).not.toBeInTheDocument();
	});

	it("renders nothing until the flags have resolved", () => {
		renderWithProviders(<FeedStrip />, {
			flags: { fe_feed: true },
			flagsReady: false,
		});

		expect(screen.queryByText("Стрічка оновлень")).not.toBeInTheDocument();
	});

	it("renders the feed and links to /feed when the flag is on", () => {
		renderWithProviders(<FeedStrip />, { flags: { fe_feed: true } });

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
		renderWithProviders(<FeedStrip />, { flags: { fe_feed: true } });

		const pinned = screen.getByText("Хакатон факультету інформатики");
		const unpinned = screen.getByText("Реєстрація на вибіркові відкрита");

		// pinned promo (later by recency) should appear before the unpinned one.
		expect(
			pinned.compareDocumentPosition(unpinned) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("disables both arrows when nothing overflows", () => {
		renderWithProviders(<FeedStrip />, { flags: { fe_feed: true } });

		expect(screen.getByRole("button", { name: "Попередні" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Наступні" })).toBeDisabled();
	});

	it("enables next at the start and pages by ~one viewport on click", async () => {
		const { container } = renderWithProviders(<FeedStrip />, {
			flags: { fe_feed: true },
		});

		// jsdom reports no overflow, so stub a scrollable container and
		// re-fire scroll so the hook refreshes its edge state.
		const scroller = screen.getByRole("link", {
			name: /Переглянути всю стрічку/,
		}).parentElement as HTMLElement;
		Object.defineProperty(scroller, "scrollWidth", {
			value: 1200,
			configurable: true,
		});
		Object.defineProperty(scroller, "clientWidth", {
			value: 400,
			configurable: true,
		});
		const scrollSpy = vi.fn();
		scroller.scrollBy = scrollSpy;
		fireEvent.scroll(scroller);
		expect(container).toBeInTheDocument();

		const prev = screen.getByRole("button", { name: "Попередні" });
		const next = screen.getByRole("button", { name: "Наступні" });
		await waitFor(() => {
			expect(prev).toBeDisabled();
			expect(next).toBeEnabled();
		});

		const user = userEvent.setup();
		await user.click(next);

		expect(scrollSpy).toHaveBeenCalledOnce();
		const args = scrollSpy.mock.calls[0]?.[0] as
			| { left?: number; behavior?: ScrollBehavior }
			| undefined;
		expect(args?.left).toBeCloseTo(360);
	});
});

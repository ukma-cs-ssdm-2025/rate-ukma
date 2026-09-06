import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
	FeedItem as ApiFeedItem,
	FeedListParams,
	FeedPage,
} from "@/lib/api/generated";
import { act, renderWithProviders, waitFor } from "@/test-utils/render";
import type { UseFeedReturn } from "./useFeed";
import { useFeed } from "./useFeed";

// Mocked at the HTTP mutator rather than at the generated hook, so the cursor
// threading orval generates (`useFeedListInfinite`) stays under test.
vi.mock("@/lib/api/apiClient", async () => ({
	...(await vi.importActual("@/lib/api/apiClient")),
	authorizedFetcher: vi.fn(),
}));

const { authorizedFetcher } = await import("@/lib/api/apiClient");
const mockedFetcher = vi.mocked(authorizedFetcher);

/** The query params of the nth (0-based) request the hook issued. */
function requestParams(call: number): FeedListParams {
	return mockedFetcher.mock.calls[call][0].params as FeedListParams;
}

/** The generated (snake_case) shape the endpoint returns, not the domain one. */
function apiPromo(overrides: Partial<ApiFeedItem> = {}): ApiFeedItem {
	return {
		kind: "promo",
		id: "p1",
		occurred_at: "2026-09-01T10:00:00.000Z",
		title: "Хакатон",
		body: "48 годин.",
		...overrides,
	} as ApiFeedItem;
}

/**
 * `useFeed` only exposes `loaderRef`, so paging is driven the way the real UI
 * drives it: attach the ref to a node and fire the intersection callback.
 */
let observerCallback: IntersectionObserverCallback | undefined;
const realIntersectionObserver = globalThis.IntersectionObserver;

function scrollLoaderIntoView() {
	act(() => {
		observerCallback?.(
			[{ isIntersecting: true } as IntersectionObserverEntry],
			{} as IntersectionObserver,
		);
	});
}

function renderFeed(limit = 2) {
	const feed: { current: UseFeedReturn | null } = { current: null };

	function FeedProbe() {
		const result = useFeed({ limit });
		feed.current = result;
		return <div ref={result.loaderRef} />;
	}

	renderWithProviders(<FeedProbe />, {
		queryClient: new QueryClient({
			defaultOptions: { queries: { retry: false } },
		}),
	});

	return feed as { current: UseFeedReturn };
}

beforeEach(() => {
	vi.clearAllMocks();
	observerCallback = undefined;
	globalThis.IntersectionObserver = vi.fn().mockImplementation(function (
		callback: IntersectionObserverCallback,
	) {
		observerCallback = callback;
		return {
			observe: vi.fn(),
			unobserve: vi.fn(),
			disconnect: vi.fn(),
		};
	}) as unknown as typeof IntersectionObserver;
});

afterEach(() => {
	globalThis.IntersectionObserver = realIntersectionObserver;
});

describe("useFeed", () => {
	it("threads the server's cursor into the next page request", async () => {
		mockedFetcher
			.mockResolvedValueOnce({
				items: [apiPromo({ id: "p1" })],
				next_cursor: "cursor-2",
			} satisfies FeedPage)
			.mockResolvedValueOnce({
				items: [apiPromo({ id: "p2" })],
				next_cursor: null,
			} satisfies FeedPage);

		const feed = renderFeed();

		await waitFor(() => expect(feed.current.items).toHaveLength(1));
		expect(requestParams(0)).toEqual({ limit: 2, cursor: undefined });
		expect(feed.current.hasMore).toBe(true);

		scrollLoaderIntoView();

		await waitFor(() => expect(feed.current.items).toHaveLength(2));
		expect(requestParams(1)).toEqual({ limit: 2, cursor: "cursor-2" });
		expect(feed.current.items.map((item) => item.id)).toEqual(["p1", "p2"]);
	});

	it("stops paging once the server returns a null next_cursor", async () => {
		mockedFetcher.mockResolvedValue({
			items: [apiPromo()],
			next_cursor: null,
		} satisfies FeedPage);

		const feed = renderFeed();

		await waitFor(() => expect(feed.current.items).toHaveLength(1));
		expect(feed.current.hasMore).toBe(false);

		scrollLoaderIntoView();

		await waitFor(() => expect(mockedFetcher).toHaveBeenCalledTimes(1));
	});

	it("reports an error and no items when the request fails", async () => {
		mockedFetcher.mockRejectedValue(new Error("boom"));

		const feed = renderFeed();

		await waitFor(() => expect(feed.current.isError).toBe(true));
		expect(feed.current.items).toEqual([]);
		expect(feed.current.hasMore).toBe(false);
		expect(feed.current.isLoading).toBe(false);
	});
});

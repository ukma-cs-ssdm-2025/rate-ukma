import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
	FeedItem as ApiFeedItem,
	FeedListParams,
	FeedPage,
} from "@/lib/api/generated";
import * as apiClientModule from "@/lib/api/apiClient";
import { act, renderWithProviders, waitFor } from "@/test-utils/render";
import type { UseFeedReturn } from "./useFeed";
import { useFeed } from "./useFeed";

// Stubbed at the HTTP mutator rather than at the generated hook, so the cursor
// threading orval generates (`useFeedListInfinite`) stays under test.
let mockedFetcher: ReturnType<typeof vi.spyOn>;

/** The query params of the nth (0-based) request the hook issued. */
function requestParams(call: number): FeedListParams {
	// SAFETY: the hook always calls authorizedFetcher with a params object.
	return mockedFetcher.mock.calls[call][0].params as FeedListParams;
}

/** The generated (snake_case) shape the endpoint returns, not the domain one. */
function apiPromo(overrides: Partial<ApiFeedItem> = {}): ApiFeedItem {
	// SAFETY: promo fixtures always carry the literal promo kind with defaults.
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

class ScrollObserverStub implements IntersectionObserver {
	readonly root: Element | Document | null = null;
	readonly rootMargin = "";
	readonly scrollMargin = "";
	readonly thresholds: readonly number[] = [];
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();

	constructor(callback: IntersectionObserverCallback) {
		observerCallback = callback;
	}

	takeRecords(): IntersectionObserverEntry[] {
		return [];
	}
}

function scrollLoaderIntoView() {
	act(() => {
		observerCallback?.(
			// SAFETY: the hook only reads isIntersecting off the entry.
			[{ isIntersecting: true } as IntersectionObserverEntry],
			// SAFETY: the hook never touches the observer instance itself.
			{} as IntersectionObserver,
		);
	});
}

/** Write-once cell the probe fills during render. */
interface FeedProbeState {
	current: UseFeedReturn | null;
}

function renderFeed(limit = 2) {
	const feed: FeedProbeState = { current: null };

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

	return {
		get current(): UseFeedReturn {
			if (feed.current === null) {
				throw new Error("FeedProbe did not render");
			}
			return feed.current;
		},
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mockedFetcher = vi.spyOn(apiClientModule, "authorizedFetcher");
	observerCallback = undefined;
	globalThis.IntersectionObserver = ScrollObserverStub;
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

import type { ReactNode } from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";

import * as LayoutModule from "@/components/Layout";
import { FeedStrip } from "@/features/feed/components/FeedStrip";
import * as apiClientModule from "@/lib/api/apiClient";
import { FeedRoute } from "@/routes/feed";
import { Providers, screen, waitFor } from "@/test-utils/render";
import { renderWithRouter } from "@/test-utils/router";

// The real `useFeed` runs here (unlike the component tests, which stub it), so
// the flag-to-request wiring is what is under test. Stubbing the HTTP mutator
// rather than a generated export keeps the generated hook in the path.
let fetcherMock: ReturnType<typeof vi.spyOn>;

// The strip and the route render real `Link`s, so they mount in a real memory
// router instead of a module mock. `Link` is a forwardRef object, not a
// function, so it cannot be spied on.
async function renderWithFlags(
	ui: ReactNode,
	options?: { flags?: Record<string, boolean>; flagsReady?: boolean },
) {
	await renderWithRouter(
		<Providers flags={options?.flags} flagsReady={options?.flagsReady}>
			{ui}
		</Providers>,
	);
}

describe("feed flag gating", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		fetcherMock = vi.spyOn(apiClientModule, "authorizedFetcher");
		fetcherMock.mockResolvedValue({ items: [], next_cursor: null });
		vi.spyOn(LayoutModule, "default").mockImplementation(
			({ children }: { children: ReactNode }) => <>{children}</>,
		);
	});

	it("issues no request from the strip when the feed flag is off", async () => {
		await renderWithFlags(<FeedStrip />, { flags: { fe_feed: false } });

		await waitFor(() => expect(fetcherMock).not.toHaveBeenCalled());
	});

	it("issues no request from the strip until the flags have resolved", async () => {
		await renderWithFlags(<FeedStrip />, {
			flags: { fe_feed: true },
			flagsReady: false,
		});

		await waitFor(() => expect(fetcherMock).not.toHaveBeenCalled());
	});

	it("issues no request from the feed route when the feed flag is off", async () => {
		await renderWithFlags(<FeedRoute />, { flags: { fe_feed: false } });

		expect(screen.getByText("Стрічка наразі недоступна.")).toBeInTheDocument();
		await waitFor(() => expect(fetcherMock).not.toHaveBeenCalled());
	});

	it("requests the feed once the flag is on", async () => {
		await renderWithFlags(<FeedRoute />, { flags: { fe_feed: true } });

		await waitFor(() => expect(fetcherMock).toHaveBeenCalled());
	});
});

import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PromoBanner as PromoBannerModel } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { renderWithProviders, screen } from "@/test-utils/render";
import { PromoBanner } from "./PromoBanner";

const { usePromoBannerListMock } = vi.hoisted(() => ({
	usePromoBannerListMock: vi.fn(),
}));

// Only the promo query is stubbed; the rest of the generated client stays real
// so co-rendered providers (auth, flags) keep working.
vi.mock("@/lib/api/generated", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/api/generated")>()),
	usePromoBannerList: usePromoBannerListMock,
}));

const banner: PromoBannerModel = {
	id: "test-promo-1",
	href: "https://example.com/events",
	logo_url: "http://localhost:8000/media/promo/logo.svg",
	logo_alt: "KMA Events",
	title: "KMA Events",
	description: "Афіша подій",
	cta_label: "Відкрити",
};

function mockBanner(value: PromoBannerModel | null) {
	usePromoBannerListMock.mockReturnValue({ data: { banner: value } });
}

afterEach(() => {
	globalThis.localStorage.clear();
	vi.clearAllMocks();
});

describe("PromoBanner", () => {
	it("renders the banner configured in admin", () => {
		mockBanner(banner);
		renderWithProviders(<PromoBanner />);

		expect(screen.getByTestId(testIds.promo.banner)).toBeInTheDocument();
		expect(screen.getByTestId(testIds.promo.link)).toHaveAttribute(
			"href",
			banner.href,
		);
		expect(screen.getByRole("img")).toHaveAttribute("src", banner.logo_url);
	});

	it("renders nothing when no banner is active", () => {
		mockBanner(null);
		renderWithProviders(<PromoBanner />);

		expect(screen.queryByTestId(testIds.promo.banner)).not.toBeInTheDocument();
	});

	it("renders nothing while the request is still in flight", () => {
		usePromoBannerListMock.mockReturnValue({ data: undefined });
		renderWithProviders(<PromoBanner />);

		expect(screen.queryByTestId(testIds.promo.banner)).not.toBeInTheDocument();
	});

	it("omits the logo when the banner has none", () => {
		mockBanner({ ...banner, logo_url: null });
		renderWithProviders(<PromoBanner />);

		expect(screen.getByTestId(testIds.promo.banner)).toBeInTheDocument();
		expect(screen.queryByRole("img")).not.toBeInTheDocument();
	});

	it("hides the banner when dismissed and keeps it hidden on remount", async () => {
		const user = userEvent.setup();
		mockBanner(banner);
		const { unmount } = renderWithProviders(<PromoBanner />);

		await user.click(screen.getByTestId(testIds.promo.dismissButton));
		expect(screen.queryByTestId(testIds.promo.banner)).not.toBeInTheDocument();

		unmount();
		renderWithProviders(<PromoBanner />);

		expect(screen.queryByTestId(testIds.promo.banner)).not.toBeInTheDocument();
	});

	it("reappears when the promo id changes", async () => {
		const user = userEvent.setup();
		mockBanner(banner);
		const { unmount } = renderWithProviders(<PromoBanner />);

		await user.click(screen.getByTestId(testIds.promo.dismissButton));
		unmount();

		mockBanner({ ...banner, id: "test-promo-2" });
		renderWithProviders(<PromoBanner />);

		expect(screen.getByTestId(testIds.promo.banner)).toBeInTheDocument();
	});
});

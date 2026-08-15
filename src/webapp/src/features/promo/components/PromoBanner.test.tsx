import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils/render";
import { testIds } from "@/lib/test-ids";
import type { PromoBannerContent } from "@/features/promo/promoConfig";
import { PROMO_BANNER_FLAG, PromoBanner } from "./PromoBanner";

const content: PromoBannerContent = {
	id: "test-promo-1",
	href: "https://example.com/events",
	logoUrl: "/favicon-kma-events-ad.svg",
	logoAlt: "KMA Events",
	title: "KMA Events",
	description: "Афіша подій",
	ctaLabel: "Відкрити",
};

const enabled = { [PROMO_BANNER_FLAG]: true };

afterEach(() => {
	globalThis.localStorage.clear();
});

describe("PromoBanner", () => {
	it("renders the link when the flag is on", () => {
		renderWithProviders(<PromoBanner content={content} />, { flags: enabled });

		expect(screen.getByTestId(testIds.promo.banner)).toBeInTheDocument();
		expect(screen.getByTestId(testIds.promo.link)).toHaveAttribute(
			"href",
			content.href,
		);
	});

	it("renders nothing when the flag is off", () => {
		renderWithProviders(<PromoBanner content={content} />);

		expect(screen.queryByTestId(testIds.promo.banner)).not.toBeInTheDocument();
	});

	it("hides the banner when dismissed and keeps it hidden on remount", async () => {
		const user = userEvent.setup();
		const { unmount } = renderWithProviders(<PromoBanner content={content} />, {
			flags: enabled,
		});

		await user.click(screen.getByTestId(testIds.promo.dismissButton));
		expect(screen.queryByTestId(testIds.promo.banner)).not.toBeInTheDocument();

		unmount();
		renderWithProviders(<PromoBanner content={content} />, { flags: enabled });

		expect(screen.queryByTestId(testIds.promo.banner)).not.toBeInTheDocument();
	});

	it("reappears when the promo id changes", async () => {
		const user = userEvent.setup();
		const { unmount } = renderWithProviders(<PromoBanner content={content} />, {
			flags: enabled,
		});

		await user.click(screen.getByTestId(testIds.promo.dismissButton));
		unmount();

		renderWithProviders(
			<PromoBanner content={{ ...content, id: "test-promo-2" }} />,
			{ flags: enabled },
		);

		expect(screen.getByTestId(testIds.promo.banner)).toBeInTheDocument();
	});
});

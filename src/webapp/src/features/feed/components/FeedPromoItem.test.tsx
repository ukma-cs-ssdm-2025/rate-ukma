import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FeedPromoItem as FeedPromoItemData } from "@/lib/api/generated";
import { createMockFeedPromoItem } from "@/test-utils/factories";
import { FeedPromoItem } from "./FeedPromoItem";

const baseItem = createMockFeedPromoItem({
	id: "p1",
	occurred_at: new Date().toISOString(),
	title: "Хакатон факультету інформатики",
	body: "48 годин, 12–14 вересня.",
	label: "Подія",
	cta_label: "Зареєструватися",
	cta_href: "https://example.com/hack",
	accent: "INFO",
});

describe("FeedPromoItem", () => {
	it("renders the label, title, body and CTA link", () => {
		render(<FeedPromoItem item={baseItem} />);

		expect(screen.getByText("Подія")).toBeInTheDocument();
		expect(
			screen.getByText("Хакатон факультету інформатики"),
		).toBeInTheDocument();
		expect(screen.getByText("48 годин, 12–14 вересня.")).toBeInTheDocument();

		const cta = screen.getByRole("link", { name: /Зареєструватися/ });
		expect(cta).toHaveAttribute("href", "https://example.com/hack");
	});

	it("opens the CTA in a new tab", () => {
		render(<FeedPromoItem item={baseItem} />);

		const cta = screen.getByRole("link", { name: /Зареєструватися/ });
		expect(cta).toHaveAttribute("target", "_blank");
		expect(cta).toHaveAttribute("rel", "noopener noreferrer");
	});

	it.each(["banner", "card"] as const)(
		"shows the image as a decorative avatar in the %s variant",
		(variant) => {
			const item = { ...baseItem, image_url: "https://example.com/promo.png" };

			const { container } = render(
				<FeedPromoItem item={item} variant={variant} />,
			);

			// The title beside it already names the channel, so no alt text.
			const avatar = container.querySelector("img");
			expect(avatar).toHaveAttribute("src", "https://example.com/promo.png");
			expect(avatar).toHaveAttribute("alt", "");
		},
	);

	it("renders no image when the promo has none", () => {
		const { container } = render(
			<FeedPromoItem
				item={{ ...baseItem, image_url: null }}
				variant="banner"
			/>,
		);

		expect(container.querySelector("img")).toBeNull();
	});

	it("falls back to the default label when none is provided", () => {
		render(<FeedPromoItem item={{ ...baseItem, label: "" }} />);

		expect(screen.getByText("Оголошення")).toBeInTheDocument();
	});

	it("omits the CTA when there is no CTA label", () => {
		render(<FeedPromoItem item={{ ...baseItem, cta_label: "" }} />);

		expect(screen.queryByRole("link")).not.toBeInTheDocument();
	});

	it("omits the CTA when there is no CTA link", () => {
		render(<FeedPromoItem item={{ ...baseItem, cta_href: "" }} />);

		expect(screen.queryByRole("link")).not.toBeInTheDocument();
		expect(screen.queryByText("Зареєструватися")).not.toBeInTheDocument();
	});

	// A server-side accent this bundle predates is a plain object miss, not
	// undefined, so `??` on `item.accent` alone would leave the lookup
	// undefined and throw on `.container`.
	it("falls back to BRAND styling for an unknown accent", () => {
		const unknownAccent = {
			...baseItem,
			accent: "NEON" as FeedPromoItemData["accent"],
		};

		expect(() => render(<FeedPromoItem item={unknownAccent} />)).not.toThrow();
		expect(screen.getByText(baseItem.title)).toBeInTheDocument();
	});
});

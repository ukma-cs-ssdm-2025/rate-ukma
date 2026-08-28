import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FeedPromoItem as FeedPromoItemType } from "../feedTypes";
import { FeedPromoItem } from "./FeedPromoItem";

const baseItem: FeedPromoItemType = {
	kind: "promo",
	id: "p1",
	createdAt: new Date().toISOString(),
	title: "Хакатон факультету інформатики",
	body: "48 годин, 12–14 вересня.",
	label: "Подія",
	ctaLabel: "Зареєструватися",
	ctaHref: "https://example.com/hack",
	accent: "info",
};

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

	it("falls back to the default label when none is provided", () => {
		render(<FeedPromoItem item={{ ...baseItem, label: undefined }} />);

		expect(screen.getByText("Оголошення")).toBeInTheDocument();
	});

	it("omits the CTA when there is no ctaLabel", () => {
		render(<FeedPromoItem item={{ ...baseItem, ctaLabel: undefined }} />);

		expect(screen.queryByRole("link")).not.toBeInTheDocument();
	});
});

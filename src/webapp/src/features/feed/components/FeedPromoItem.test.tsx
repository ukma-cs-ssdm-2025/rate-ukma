import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { testIds } from "@/lib/test-ids";
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
	accent: "INFO",
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

	it("opens the CTA in a new tab", () => {
		render(<FeedPromoItem item={baseItem} />);

		const cta = screen.getByRole("link", { name: /Зареєструватися/ });
		expect(cta).toHaveAttribute("target", "_blank");
		expect(cta).toHaveAttribute("rel", "noopener noreferrer");
	});

	it("renders the image in the banner variant", () => {
		const item = { ...baseItem, imageUrl: "https://example.com/promo.png" };

		render(<FeedPromoItem item={item} variant="banner" />);

		expect(screen.getByRole("img", { name: item.title })).toHaveAttribute(
			"src",
			"https://example.com/promo.png",
		);
	});

	it("omits the image in the card variant used by the homepage strip", () => {
		render(
			<FeedPromoItem
				item={{ ...baseItem, imageUrl: "https://example.com/promo.png" }}
			/>,
		);

		expect(screen.queryByRole("img")).not.toBeInTheDocument();
	});

	it("renders no image when the promo has none", () => {
		render(
			<FeedPromoItem item={{ ...baseItem, imageUrl: null }} variant="banner" />,
		);

		expect(screen.queryByRole("img")).not.toBeInTheDocument();
	});

	it("falls back to the default label when none is provided", () => {
		render(<FeedPromoItem item={{ ...baseItem, label: undefined }} />);

		expect(screen.getByText("Оголошення")).toBeInTheDocument();
	});

	it("omits the CTA when there is no ctaLabel", () => {
		render(<FeedPromoItem item={{ ...baseItem, ctaLabel: undefined }} />);

		expect(screen.queryByRole("link")).not.toBeInTheDocument();
	});

	it("omits the CTA when there is no ctaHref", () => {
		render(<FeedPromoItem item={{ ...baseItem, ctaHref: undefined }} />);

		expect(screen.queryByRole("link")).not.toBeInTheDocument();
		expect(screen.queryByText("Зареєструватися")).not.toBeInTheDocument();
	});

	describe("long-form body in the banner variant", () => {
		const longBody = Array.from(
			{ length: 10 },
			() =>
				"## Перший абзац\n\n**Другий** абзац з [посиланням](https://example.com/more).",
		).join("\n\n");
		const originalScrollHeight = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"scrollHeight",
		);

		// jsdom does no layout, so fake the overflow the clamp measures.
		beforeEach(() => {
			Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
				configurable: true,
				value: 200,
			});
		});

		afterEach(() => {
			if (originalScrollHeight) {
				Object.defineProperty(
					HTMLElement.prototype,
					"scrollHeight",
					originalScrollHeight,
				);
			} else {
				Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
			}
		});

		it("clamps the body and opens the full post in a dialog", async () => {
			const user = userEvent.setup();

			render(
				<FeedPromoItem
					item={{
						...baseItem,
						body: longBody,
						imageUrl: "https://example.com/promo.png",
					}}
					variant="banner"
				/>,
			);

			// Preview is plain text: markup stripped, nothing rendered as elements.
			const body = screen.getByText(/Перший абзац/u);
			expect(body).toHaveClass("line-clamp-3");
			expect(body).toHaveClass("whitespace-pre-wrap");
			expect(body).toHaveTextContent(
				/^Перший абзац\s+Другий абзац з посиланням/u,
			);
			expect(body).not.toHaveTextContent(/[#*[\]]/u);
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

			await user.click(screen.getByTestId(testIds.feed.readMoreButton));

			// The dialog renders the markdown.
			const dialog = screen.getByRole("dialog", { name: baseItem.title });
			expect(
				within(dialog).getAllByRole("heading", { name: "Перший абзац" }),
			).toHaveLength(10);
			expect(within(dialog).getAllByRole("strong")[0]).toHaveTextContent(
				"Другий",
			);
			const inlineLink = within(dialog).getAllByRole("link", {
				name: "посиланням",
			})[0];
			expect(inlineLink).toHaveAttribute("href", "https://example.com/more");
			expect(inlineLink).toHaveAttribute("target", "_blank");
			expect(inlineLink).toHaveAttribute("rel", "noopener noreferrer");
			expect(within(dialog).getByText("Подія")).toBeInTheDocument();
			expect(
				within(dialog).getByRole("link", { name: /Зареєструватися/ }),
			).toHaveAttribute("href", "https://example.com/hack");
			expect(
				within(dialog).getByRole("img", { name: baseItem.title }),
			).toBeInTheDocument();

			await user.keyboard("{Escape}");

			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		});

		it("shows read-more button on the truncated strip card", () => {
			render(<FeedPromoItem item={{ ...baseItem, body: longBody }} />);

			expect(screen.getByText(/Перший абзац/u)).toHaveClass("line-clamp-2");
			expect(screen.getByTestId(testIds.feed.readMoreButton)).toHaveTextContent(
				"Читати більше",
			);
		});
	});

	// A server-side accent this bundle predates is a plain object miss, not
	// undefined, so `??` on `item.accent` alone would leave the lookup
	// undefined and throw on `.container`.
	it("falls back to BRAND styling for an unknown accent", () => {
		const unknownAccent = {
			...baseItem,
			accent: "NEON" as FeedPromoItemType["accent"],
		};

		expect(() => render(<FeedPromoItem item={unknownAccent} />)).not.toThrow();
		expect(screen.getByText(baseItem.title)).toBeInTheDocument();
	});
});

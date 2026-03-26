import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RatingComment } from "./RatingComment";

const originalScrollHeightDescriptor = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	"scrollHeight",
);

describe("RatingComment", () => {
	describe("when text overflows the clamp", () => {
		beforeEach(() => {
			Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
				configurable: true,
				value: 200,
			});
		});

		afterEach(() => {
			if (originalScrollHeightDescriptor) {
				Object.defineProperty(
					HTMLElement.prototype,
					"scrollHeight",
					originalScrollHeightDescriptor,
				);
			} else {
				// scrollHeight was not an own property before we patched it;
				// delete the mock so the prototype chain lookup is restored.
				Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
			}
		});

		it("shows expand and collapse controls for long comments", async () => {
			const user = userEvent.setup();
			const longComment = "Дуже змістовний відгук. ".repeat(20);

			render(<RatingComment comment={longComment} />);

			const toggleButton = screen.getByRole("button", { name: "Читати далі" });
			const comment = screen.getByText(/Дуже змістовний відгук/u);

			expect(toggleButton).toHaveAttribute("aria-expanded", "false");
			expect(comment).toHaveClass("line-clamp-4");

			await user.click(toggleButton);

			expect(screen.getByRole("button", { name: "Згорнути" })).toHaveAttribute(
				"aria-expanded",
				"true",
			);
			expect(comment).not.toHaveClass("line-clamp-4");
		});
	});

	it("does not show expand control for short comments", () => {
		render(<RatingComment comment="Короткий відгук" />);

		expect(screen.getByText("Короткий відгук")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /читати далі|згорнути/i }),
		).not.toBeInTheDocument();
	});
});

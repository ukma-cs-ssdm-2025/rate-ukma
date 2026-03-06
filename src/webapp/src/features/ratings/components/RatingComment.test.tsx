import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RatingComment } from "./RatingComment";

describe("RatingComment", () => {
	it("shows expand and collapse controls for long comments", async () => {
		const user = userEvent.setup();
		const longComment = "Дуже змістовний відгук. ".repeat(20);

		render(<RatingComment comment={longComment} />);

		const toggleButton = screen.getByRole("button", { name: "Читати далі" });
		const comment = screen.getByText(/Дуже змістовний відгук/u);

		expect(toggleButton).toHaveAttribute("aria-expanded", "false");
		expect(comment).toHaveClass("line-clamp-4");

		await user.click(toggleButton);

		expect(screen.getByRole("button", { name: "Менше" })).toHaveAttribute(
			"aria-expanded",
			"true",
		);
		expect(comment).not.toHaveClass("line-clamp-4");
	});

	it("does not show expand control for short comments", () => {
		render(<RatingComment comment="Короткий відгук" />);

		expect(screen.getByText("Короткий відгук")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /читати далі|менше/i }),
		).not.toBeInTheDocument();
	});
});

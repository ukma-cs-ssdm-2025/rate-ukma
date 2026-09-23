import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RatingButton } from "./RatingButton";

describe("RatingButton", () => {
	it("renders a link child as the button when asChild is set", () => {
		render(
			<RatingButton canRate size="sm" asChild>
				<a href="/courses/c-algo">Оцінити</a>
			</RatingButton>,
		);

		const link = screen.getByRole("link", { name: "Оцінити" });
		expect(link).toHaveAttribute("href", "/courses/c-algo");
		expect(link.querySelector("svg")).not.toBeNull();
	});
});

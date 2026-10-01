import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/Tooltip";
import { CANNOT_RATE_TOOLTIP_TEXT } from "../definitions/ratingDefinitions";
import { RatingButton } from "./RatingButton";

function renderButton(canRate: boolean, onClick = vi.fn()) {
	render(
		<TooltipProvider>
			<RatingButton canRate={canRate} onClick={onClick}>
				Оцінити цей курс
			</RatingButton>
		</TooltipProvider>,
	);
	return onClick;
}

describe("RatingButton", () => {
	it("opens rating when the course can be rated", async () => {
		const onClick = renderButton(true);

		await userEvent.click(
			screen.getByRole("button", { name: "Оцінити цей курс" }),
		);

		expect(onClick).toHaveBeenCalledOnce();
	});

	it("explains why rating is closed instead of opening it", async () => {
		const onClick = renderButton(false);

		await userEvent.click(
			screen.getByRole("button", { name: "Оцінити цей курс" }),
		);

		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			CANNOT_RATE_TOOLTIP_TEXT,
		);
		expect(onClick).not.toHaveBeenCalled();
	});
});

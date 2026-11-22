import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataSegments } from "./DataBits";

const TABS = [
	{ value: "pending", label: "Чекають рішення", count: 32_388 },
	{ value: "history", label: "Історія" },
	{ value: "rules", label: "Правила" },
] as const;

afterEach(() => {
	vi.restoreAllMocks();
});

describe("DataSegments", () => {
	it("works as tabs and scrolls the active tab into view on a narrow screen", () => {
		// Arrange
		vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockReturnValue(300);
		vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(90);
		vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(320);

		// Act
		render(
			<DataSegments
				tabs
				label="Вкладки оновлень"
				value="rules"
				onChange={() => {}}
				items={TABS}
			/>,
		);

		// Assert
		const list = screen.getByRole("tablist", { name: "Вкладки оновлень" });
		expect(screen.getByRole("tab", { name: "Правила" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(list.scrollLeft).toBe(70);
	});

	it("works as a radio group for filters", () => {
		// Arrange & Act
		render(
			<DataSegments
				label="Стан"
				value="history"
				onChange={() => {}}
				items={TABS}
			/>,
		);

		// Assert
		expect(screen.getByRole("radio", { name: "Історія" })).toHaveAttribute(
			"aria-checked",
			"true",
		);
	});

	it("moves with arrow keys and keeps one tab stop", async () => {
		// Arrange
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(
			<DataSegments
				label="Стан"
				value="history"
				onChange={onChange}
				items={TABS}
			/>,
		);

		// Act
		await user.click(screen.getByRole("radio", { name: "Історія" }));
		await user.keyboard("{ArrowRight}");

		// Assert
		expect(onChange).toHaveBeenLastCalledWith("rules");
		expect(screen.getByRole("radio", { name: "Правила" })).toHaveFocus();
		expect(
			screen
				.getAllByRole("radio")
				.map((radio) => radio.getAttribute("tabindex")),
		).toEqual(["-1", "0", "-1"]);
	});
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { testIds } from "@/lib/test-ids";
import { ModeToggle } from "./ModeToggle";
import { ThemeProvider } from "./ThemeProvider";

const STORAGE_KEY = "rate-ukma-theme";

function renderToggle() {
	return render(
		<ThemeProvider>
			<ModeToggle />
		</ThemeProvider>,
	);
}

beforeEach(() => {
	localStorage.clear();
	delete document.documentElement.dataset.colorScheme;
});

describe("ModeToggle", () => {
	it("offers Light, Dark and System options in the menu", async () => {
		const user = userEvent.setup();
		renderToggle();

		await user.click(screen.getByTestId(testIds.header.themeToggle));

		expect(
			screen.getByTestId(`${testIds.header.themeToggle}-option-light`),
		).toHaveTextContent("Світла");
		expect(
			screen.getByTestId(`${testIds.header.themeToggle}-option-dark`),
		).toHaveTextContent("Темна");
		expect(
			screen.getByTestId(`${testIds.header.themeToggle}-option-system`),
		).toHaveTextContent("Система");
	});

	it("selecting System persists the choice and hands the scheme to CSS", async () => {
		localStorage.setItem(STORAGE_KEY, "dark");
		const user = userEvent.setup();
		renderToggle();
		expect(document.documentElement.dataset.colorScheme).toBe("dark");

		await user.click(screen.getByTestId(testIds.header.themeToggle));
		await user.click(
			screen.getByTestId(`${testIds.header.themeToggle}-option-system`),
		);

		expect(localStorage.getItem(STORAGE_KEY)).toBe("system");
		expect(document.documentElement.dataset.colorScheme).toBeUndefined();
	});

	it("selecting Dark applies it instantly without a reload", async () => {
		const user = userEvent.setup();
		renderToggle();

		await user.click(screen.getByTestId(testIds.header.themeToggle));
		await user.click(
			screen.getByTestId(`${testIds.header.themeToggle}-option-dark`),
		);

		expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
		expect(document.documentElement.dataset.colorScheme).toBe("dark");
	});
});

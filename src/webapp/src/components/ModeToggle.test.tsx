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
	document.documentElement.classList.remove("light", "dark");
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

	it("selecting System persists the choice and follows the OS theme", async () => {
		const user = userEvent.setup();
		renderToggle();

		await user.click(screen.getByTestId(testIds.header.themeToggle));
		await user.click(
			screen.getByTestId(`${testIds.header.themeToggle}-option-system`),
		);

		expect(localStorage.getItem(STORAGE_KEY)).toBe("system");
		// Global matchMedia mock reports light OS theme.
		expect(document.documentElement.classList.contains("light")).toBe(true);
	});

	it("selecting Dark applies it instantly without a reload", async () => {
		const user = userEvent.setup();
		renderToggle();

		await user.click(screen.getByTestId(testIds.header.themeToggle));
		await user.click(
			screen.getByTestId(`${testIds.header.themeToggle}-option-dark`),
		);

		expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	});
});

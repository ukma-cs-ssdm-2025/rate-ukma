import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { ThemeProvider, useTheme } from "./ThemeProvider";

function ThemeProbe() {
	const { theme, setTheme } = useTheme();
	return (
		<div>
			<span data-testid="current-theme">{theme}</span>
			<button type="button" onClick={() => setTheme("light")}>
				to-light
			</button>
			<button type="button" onClick={() => setTheme("dark")}>
				to-dark
			</button>
			<button type="button" onClick={() => setTheme("system")}>
				to-system
			</button>
		</div>
	);
}

const STORAGE_KEY = "rate-ukma-theme";

function colorScheme() {
	return document.documentElement.dataset.colorScheme;
}

function renderProvider() {
	return render(
		<ThemeProvider>
			<ThemeProbe />
		</ThemeProvider>,
	);
}

beforeEach(() => {
	localStorage.clear();
	delete document.documentElement.dataset.colorScheme;
});

describe("ThemeProvider", () => {
	it("defaults to System and leaves the scheme to CSS", () => {
		renderProvider();

		expect(screen.getByTestId("current-theme")).toHaveTextContent("system");
		expect(colorScheme()).toBeUndefined();
	});

	it("falls back to System when the stored value is invalid", () => {
		localStorage.setItem(STORAGE_KEY, "banana");

		renderProvider();

		expect(screen.getByTestId("current-theme")).toHaveTextContent("system");
		expect(colorScheme()).toBeUndefined();
	});

	it("applies a stored explicit choice to <html>", () => {
		localStorage.setItem(STORAGE_KEY, "light");

		renderProvider();

		expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
		expect(colorScheme()).toBe("light");
	});

	it("persists the choice and ends rapid toggling on the last value", async () => {
		const user = userEvent.setup();
		renderProvider();

		await user.click(screen.getByRole("button", { name: "to-light" }));
		expect(colorScheme()).toBe("light");
		await user.click(screen.getByRole("button", { name: "to-dark" }));
		expect(colorScheme()).toBe("dark");
		await user.click(screen.getByRole("button", { name: "to-system" }));

		expect(screen.getByTestId("current-theme")).toHaveTextContent("system");
		expect(localStorage.getItem(STORAGE_KEY)).toBe("system");
		expect(colorScheme()).toBeUndefined();
	});
});

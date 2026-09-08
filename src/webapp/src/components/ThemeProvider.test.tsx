import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider, useTheme } from "./ThemeProvider";

type ChangeListener = (event: { matches: boolean }) => void;

function mockMatchMedia(initialMatches: boolean) {
	let matches = initialMatches;
	const listeners = new Set<ChangeListener>();
	const mql = {
		get matches() {
			return matches;
		},
		media: "(prefers-color-scheme: dark)",
		addEventListener: vi.fn((_type: string, listener: ChangeListener) => {
			listeners.add(listener);
		}),
		removeEventListener: vi.fn((_type: string, listener: ChangeListener) => {
			listeners.delete(listener);
		}),
		addListener: vi.fn(),
		removeListener: vi.fn(),
		dispatchEvent: vi.fn(),
	};
	vi.mocked(globalThis.matchMedia).mockReturnValue(
		mql as unknown as MediaQueryList,
	);
	return {
		setMatches(next: boolean) {
			matches = next;
			for (const listener of listeners) listener({ matches: next });
		},
		mql,
	};
}

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
			<button type="button" onClick={() => setTheme("banana" as "light")}>
				to-invalid
			</button>
		</div>
	);
}

const STORAGE_KEY = "rate-ukma-theme";

beforeEach(() => {
	localStorage.clear();
	document.documentElement.classList.remove("light", "dark");
});

describe("ThemeProvider", () => {
	it("follows the OS dark theme when nothing is stored", () => {
		mockMatchMedia(true);

		render(
			<ThemeProvider>
				<ThemeProbe />
			</ThemeProvider>,
		);

		expect(screen.getByTestId("current-theme")).toHaveTextContent("system");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	});

	it("falls back to the OS theme when the stored value is invalid", () => {
		mockMatchMedia(false);
		localStorage.setItem(STORAGE_KEY, "banana");

		render(
			<ThemeProvider>
				<ThemeProbe />
			</ThemeProvider>,
		);

		expect(screen.getByTestId("current-theme")).toHaveTextContent("system");
		expect(document.documentElement.classList.contains("light")).toBe(true);
	});

	it("keeps an explicit choice even when the OS theme differs", () => {
		mockMatchMedia(true);
		localStorage.setItem(STORAGE_KEY, "light");

		render(
			<ThemeProvider>
				<ThemeProbe />
			</ThemeProvider>,
		);

		expect(document.documentElement.classList.contains("light")).toBe(true);
		expect(document.documentElement.classList.contains("dark")).toBe(false);
	});

	it("applies the OS change instantly while System is selected", () => {
		const { setMatches } = mockMatchMedia(false);

		render(
			<ThemeProvider>
				<ThemeProbe />
			</ThemeProvider>,
		);

		expect(document.documentElement.classList.contains("light")).toBe(true);

		act(() => {
			setMatches(true);
		});

		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.classList.contains("light")).toBe(false);
	});

	it("ignores OS changes while an explicit theme is selected", () => {
		const { setMatches } = mockMatchMedia(false);
		localStorage.setItem(STORAGE_KEY, "light");

		render(
			<ThemeProvider>
				<ThemeProbe />
			</ThemeProvider>,
		);

		act(() => {
			setMatches(true);
		});

		expect(document.documentElement.classList.contains("light")).toBe(true);
	});

	it("persists the choice and ends rapid toggling on the last value", async () => {
		mockMatchMedia(false);
		const user = userEvent.setup();

		render(
			<ThemeProvider>
				<ThemeProbe />
			</ThemeProvider>,
		);

		await user.click(screen.getByRole("button", { name: "to-light" }));
		await user.click(screen.getByRole("button", { name: "to-dark" }));
		await user.click(screen.getByRole("button", { name: "to-system" }));

		expect(screen.getByTestId("current-theme")).toHaveTextContent("system");
		expect(localStorage.getItem(STORAGE_KEY)).toBe("system");
		expect(document.documentElement.classList.contains("light")).toBe(true);
	});

	it("ignores invalid theme values passed to setTheme", async () => {
		mockMatchMedia(false);
		const user = userEvent.setup();

		render(
			<ThemeProvider>
				<ThemeProbe />
			</ThemeProvider>,
		);

		await user.click(screen.getByRole("button", { name: "to-invalid" }));

		expect(screen.getByTestId("current-theme")).toHaveTextContent("system");
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});
});

import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

if (!Element.prototype.scrollIntoView) {
	Element.prototype.scrollIntoView = vi.fn();
}

afterEach(() => {
	cleanup();
});

Object.defineProperty(globalThis, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation(function (query) {
		return {
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		};
	}),
});

globalThis.IntersectionObserver = vi.fn().mockImplementation(function () {
	return {
		observe: vi.fn(),
		unobserve: vi.fn(),
		disconnect: vi.fn(),
		root: null,
		rootMargin: "",
		thresholds: [],
		takeRecords: () => [],
	};
}) as unknown as typeof IntersectionObserver;

globalThis.ResizeObserver = vi.fn().mockImplementation(function () {
	return {
		observe: vi.fn(),
		unobserve: vi.fn(),
		disconnect: vi.fn(),
	};
}) as unknown as typeof ResizeObserver;

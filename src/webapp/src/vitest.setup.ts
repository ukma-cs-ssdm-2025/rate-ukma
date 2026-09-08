import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Cleanup after each test
afterEach(() => {
	cleanup();
});

// Mock window.matchMedia for responsive design tests
vi.stubGlobal(
	"matchMedia",
	vi.fn().mockImplementation(function (query: string) {
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
);

// Mock IntersectionObserver for components that use it
vi.stubGlobal(
	"IntersectionObserver",
	vi.fn().mockImplementation(function () {
		return {
			observe: vi.fn(),
			unobserve: vi.fn(),
			disconnect: vi.fn(),
			root: null,
			rootMargin: "",
			thresholds: [],
			takeRecords: () => [],
		};
	}),
);

// Mock ResizeObserver for components that use it
vi.stubGlobal(
	"ResizeObserver",
	vi.fn().mockImplementation(function () {
		return {
			observe: vi.fn(),
			unobserve: vi.fn(),
			disconnect: vi.fn(),
		};
	}),
);

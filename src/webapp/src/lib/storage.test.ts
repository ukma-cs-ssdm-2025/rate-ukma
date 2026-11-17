import { afterEach, describe, expect, it, vi } from "vitest";

import { localStorageAdapter } from "./storage";

describe("localStorageAdapter", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it("round-trips a value", () => {
		localStorageAdapter.setItem("k", { a: 1 });
		expect(localStorageAdapter.getItem("k")).toEqual({ a: 1 });
	});

	it("does not throw when the browser blocks storage", () => {
		vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
			throw new DOMException("blocked", "SecurityError");
		});
		expect(localStorageAdapter.getItem("k")).toBeNull();
		expect(() => localStorageAdapter.setItem("k", 1)).not.toThrow();
		expect(() => localStorageAdapter.removeItem("k")).not.toThrow();
	});
});

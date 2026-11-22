import { describe, expect, it } from "vitest";

import { arrowTarget, scrollToShow } from "./segmentScroll";

describe("scrollToShow", () => {
	it("keeps the scroll when the active segment is already in view", () => {
		expect(scrollToShow({ start: 40, size: 80 }, { start: 0, size: 300 })).toBe(
			0,
		);
	});

	it("scrolls right until a cut-off segment fits", () => {
		expect(
			scrollToShow({ start: 280, size: 90 }, { start: 0, size: 320 }),
		).toBe(50);
	});

	it("scrolls left back to a segment hidden on the left", () => {
		expect(
			scrollToShow({ start: 10, size: 90 }, { start: 120, size: 320 }),
		).toBe(10);
	});
});

describe("arrowTarget", () => {
	it("moves to the next and previous segment and wraps around", () => {
		// Assert
		expect(arrowTarget("ArrowRight", 0, 3)).toBe(1);
		expect(arrowTarget("ArrowLeft", 0, 3)).toBe(2);
		expect(arrowTarget("ArrowDown", 2, 3)).toBe(0);
		expect(arrowTarget("Home", 2, 3)).toBe(0);
		expect(arrowTarget("End", 0, 3)).toBe(2);
	});

	it("ignores other keys", () => {
		// Assert
		expect(arrowTarget("Enter", 1, 3)).toBeNull();
	});
});

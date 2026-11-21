import { describe, expect, it } from "vitest";

import { getDifficultyTone, getUsefulnessTone } from "./score-tone";

describe("getDifficultyTone", () => {
	const TONES = {
		DESTRUCTIVE: "text-destructive",
		MEDIUM: "text-chart-5",
		PRIMARY: "text-primary",
		MUTED: "text-muted-foreground",
	};

	it.each([
		["high difficulty (4.5)", 4.5, TONES.DESTRUCTIVE],
		["exact boundary 4", 4, TONES.DESTRUCTIVE],
		["medium difficulty (3.2)", 3.2, TONES.MEDIUM],
		["exact boundary 3", 3, TONES.MEDIUM],
		["low difficulty (2.1)", 2.1, TONES.PRIMARY],
	])("should return correct tone for %s", (_, value, expected) => {
		expect(getDifficultyTone(value)).toBe(expected);
	});

	it.each([
		["null", null],
		["undefined", undefined],
		["zero", 0],
	])("should return muted tone for %s value", (_, value) => {
		expect(getDifficultyTone(value)).toBe(TONES.MUTED);
	});
});

describe("getUsefulnessTone", () => {
	const TONES = {
		PRIMARY: "text-primary",
		MEDIUM: "text-chart-2",
		LOW: "text-muted-foreground",
		MUTED: "text-muted-foreground",
	};

	it.each([
		["high usefulness (4.5)", 4.5, TONES.PRIMARY],
		["medium usefulness (3.2)", 3.2, TONES.MEDIUM],
		["low usefulness (2.1)", 2.1, TONES.LOW],
	])("should return correct tone for %s", (_, value, expected) => {
		expect(getUsefulnessTone(value)).toBe(expected);
	});

	it.each([
		["null", null],
		["undefined", undefined],
	])("should return muted tone for %s value", (_, value) => {
		expect(getUsefulnessTone(value)).toBe(TONES.MUTED);
	});
});

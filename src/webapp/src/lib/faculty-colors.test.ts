import { describe, expect, it } from "vitest";

import {
	getFacultyAccent,
	getFacultyContrastTextColor,
	getFacultyHexColor,
} from "./faculty-colors";

describe("getFacultyContrastTextColor", () => {
	it("keeps white text on dark faculty colors", () => {
		expect(getFacultyContrastTextColor("#4c217a")).toBe("#ffffff");
		expect(getFacultyContrastTextColor("#006e31")).toBe("#ffffff");
	});

	it("switches to dark text on light faculty colors", () => {
		expect(getFacultyContrastTextColor("#f6b213")).toBe("#1a1a1a");
	});

	it("falls back to white text on garbage input", () => {
		expect(getFacultyContrastTextColor("not-a-color")).toBe("#ffffff");
	});
});

describe("getFacultyAccent", () => {
	it("resolves background and readable foreground for a known faculty", () => {
		const accent = getFacultyAccent("Факультет інформатики");

		expect(accent).toEqual({
			background: getFacultyHexColor("Факультет інформатики"),
			foreground: "#ffffff",
		});
	});

	it("pairs the light yellow faculty with dark text", () => {
		const accent = getFacultyAccent(
			"Факультет соціальних наук і соціальних технологій",
		);

		expect(accent?.foreground).toBe("#1a1a1a");
	});

	it("returns null when no faculty is assigned", () => {
		expect(getFacultyAccent(null)).toBeNull();
		expect(getFacultyAccent(undefined)).toBeNull();
		expect(getFacultyAccent("")).toBeNull();
	});

	it("falls back to gray for inherited property names", () => {
		expect(getFacultyAccent("__proto__")).toEqual({
			background: "#6b7280",
			foreground: "#ffffff",
		});
		expect(getFacultyAccent("toString")?.background).toBe("#6b7280");
	});
});

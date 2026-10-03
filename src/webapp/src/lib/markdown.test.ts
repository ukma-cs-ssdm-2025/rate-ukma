import { describe, expect, it } from "vitest";

import { stripMarkdown, truncateText } from "./markdown";

describe("stripMarkdown", () => {
	it("removes headings, emphasis and inline code", () => {
		expect(stripMarkdown("# Заголовок\n\n**жирний** та _курсив_ і `код`")).toBe(
			"Заголовок\n\nжирний та курсив і код",
		);
	});

	it("keeps link labels and image alt text", () => {
		expect(
			stripMarkdown("Див. [сайт](https://example.com) ![лого](a.png)"),
		).toBe("Див. сайт лого");
	});

	it("drops list, quote and rule markers", () => {
		expect(stripMarkdown("- один\n- два\n\n> цитата\n\n---\n\n1. три")).toBe(
			"один\nдва\n\nцитата\n\nтри",
		);
	});

	it("leaves plain text untouched", () => {
		expect(stripMarkdown("Просто текст.\n\nДругий абзац.")).toBe(
			"Просто текст.\n\nДругий абзац.",
		);
	});
});

describe("truncateText", () => {
	it("returns full text if under max length", () => {
		const text = "Short text";
		const result = truncateText(text, 50);
		expect(result.truncated).toBe("Short text");
		expect(result.isTruncated).toBe(false);
	});

	it("truncates markdown and strips syntax", () => {
		const text =
			"# Heading\n\n**Bold** and _italic_ text that is very long and should be truncated at a word boundary";
		const result = truncateText(text, 40);
		expect(result.isTruncated).toBe(true);
		expect(result.truncated).not.toContain("#");
		expect(result.truncated).not.toContain("**");
	});

	it("adds ellipsis when option is enabled", () => {
		const text =
			"# Heading\n\n**Bold** and _italic_ text that is very long and should be truncated at a word boundary";
		const result = truncateText(text, 40, { addEllipsis: true });
		expect(result.isTruncated).toBe(true);
		expect(result.truncated).toContain("…");
	});

	it("respects word boundaries when truncating", () => {
		const text = "One two three four five six seven eight nine ten";
		const result = truncateText(text, 20);
		expect(result.isTruncated).toBe(true);
		// Should end at word boundary without ellipsis (by default)
		expect(result.truncated).toEqual("One two three four");
	});

	it("respects word boundaries with ellipsis", () => {
		const text = "One two three four five six seven eight nine ten";
		const result = truncateText(text, 20, { addEllipsis: true });
		expect(result.isTruncated).toBe(true);
		// Should end at word boundary with ellipsis
		expect(result.truncated).toEqual("One two three four…");
	});

	it("handles very short max length", () => {
		const text = "A very long text that needs to be truncated";
		const result = truncateText(text, 5);
		expect(result.isTruncated).toBe(true);
		expect(result.truncated.length).toBeLessThanOrEqual(6); // 5 chars + ellipsis
	});

	it("removes markdown before truncating", () => {
		const text =
			"[Link text](https://example.com) here is more content that extends beyond the limit";
		const result = truncateText(text, 30);
		expect(result.truncated).not.toContain("https://");
		expect(result.truncated).toContain("Link text");
	});
});

import { describe, expect, it } from "vitest";

import { commentProblem } from "./no-comments.ts";

describe("commentProblem", () => {
	it.each([
		" oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON we wrote",
		" eslint-disable-next-line no-alert -- the prompt is the feature",
		" @ts-expect-error the library types miss this overload",
		'/ <reference types="vite/client" />',
	])("allows a directive with its reason: %s", (text) => {
		expect(commentProblem(text)).toBeUndefined();
	});

	it.each([
		" oxlint-disable-next-line typescript/no-unsafe-type-assertion",
		" oxlint-disable typescript/no-unsafe-type-assertion -- whole file",
		" eslint-enable no-alert",
		" prettier-ignore",
		" @ts-expect-error",
		" oxlint-foo",
		" Fetch the courses",
	])("rejects anything else: %s", (text) => {
		expect(commentProblem(text)).toBeDefined();
	});
});

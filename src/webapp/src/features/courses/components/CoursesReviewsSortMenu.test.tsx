import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { testIds } from "@/lib/test-ids";
import {
	COURSES_SORT_HINT,
	CoursesReviewsSortMenu,
} from "./CoursesReviewsSortMenu";

describe("CoursesReviewsSortMenu sort hint", () => {
	it("explains the real ordering rule on hover", async () => {
		const user = userEvent.setup();
		render(<CoursesReviewsSortMenu value="by-count" onValueChange={vi.fn()} />);

		const hint = screen.getByTestId(testIds.courses.sortInfoHint);
		expect(hint).toHaveAttribute("aria-label", COURSES_SORT_HINT);

		await user.hover(hint);

		expect(await screen.findByText(COURSES_SORT_HINT)).toBeInTheDocument();
	});

	it("states unrated courses always sort last", () => {
		render(<CoursesReviewsSortMenu value="newest" onValueChange={vi.fn()} />);

		expect(screen.getByTestId(testIds.courses.sortInfoHint)).toHaveAttribute(
			"aria-label",
			expect.stringContaining("без відгуків завжди внизу"),
		);
	});

	it("states column sorts replace the review sort", () => {
		render(<CoursesReviewsSortMenu value="by-count" onValueChange={vi.fn()} />);

		expect(screen.getByTestId(testIds.courses.sortInfoHint)).toHaveAttribute(
			"aria-label",
			expect.stringContaining("замінює сортування за відгуками"),
		);
	});
});

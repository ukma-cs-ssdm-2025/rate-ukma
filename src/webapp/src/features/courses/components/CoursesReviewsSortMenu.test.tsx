import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { testIds } from "@/lib/test-ids";
import {
	COURSES_SORT_HINT,
	CoursesReviewsSortMenu,
} from "./CoursesReviewsSortMenu";

describe("CoursesReviewsSortMenu sort hint", () => {
	it("shows the ordering hint inside the open menu", async () => {
		const user = userEvent.setup();
		render(<CoursesReviewsSortMenu value="by-count" onValueChange={vi.fn()} />);

		expect(screen.queryByTestId(testIds.courses.sortInfoHint)).toBeNull();

		await user.click(
			screen.getByRole("button", { name: "Сортування за відгуками" }),
		);

		expect(
			await screen.findByTestId(testIds.courses.sortInfoHint),
		).toHaveTextContent(COURSES_SORT_HINT);
	});
});

describe("CoursesReviewsSortMenu mobile variant", () => {
	it("keeps the label short", () => {
		render(
			<CoursesReviewsSortMenu
				value="by-count"
				onValueChange={vi.fn()}
				variant="mobile"
			/>,
		);

		expect(
			screen.getByTestId(testIds.courses.reviewsSortButtonMobile),
		).toHaveTextContent(/^Відгуки$/);
	});

	it("still switches the sort from the menu", async () => {
		const user = userEvent.setup();
		const onValueChange = vi.fn();
		render(
			<CoursesReviewsSortMenu
				value="by-count"
				onValueChange={onValueChange}
				variant="mobile"
			/>,
		);

		await user.click(
			screen.getByTestId(testIds.courses.reviewsSortButtonMobile),
		);
		await user.click(screen.getByRole("menuitem", { name: "Найновіші" }));

		expect(onValueChange).toHaveBeenCalledWith("newest");
	});
});

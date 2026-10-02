import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { testIds } from "@/lib/test-ids";
import { CoursesReviewsSortMenu } from "./CoursesReviewsSortMenu";

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
		).toHaveTextContent(/^Відг\.$/);
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

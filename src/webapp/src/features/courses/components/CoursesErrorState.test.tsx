import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { testIds } from "@/lib/test-ids";
import { CoursesErrorState } from "./CoursesErrorState";

describe("CoursesErrorState", () => {
	it("renders retry button when handler provided", async () => {
		const user = userEvent.setup();
		const onRetry = vi.fn();

		render(<CoursesErrorState onRetry={onRetry} />);

		const retryButton = screen.getByTestId(testIds.courses.retryButton);
		expect(retryButton).toBeInTheDocument();

		await user.click(retryButton);
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("does not render retry button when handler missing", () => {
		render(<CoursesErrorState />);

		expect(screen.getByTestId(testIds.courses.errorState)).toBeInTheDocument();
		expect(
			screen.queryByTestId(testIds.courses.retryButton),
		).not.toBeInTheDocument();
	});
});

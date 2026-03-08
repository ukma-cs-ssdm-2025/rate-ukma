import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { testIds } from "@/lib/test-ids";
import { RatingForm } from "./RatingForm";

describe("RatingForm", () => {
	it("uses a viewport-safe layout for long reviews", () => {
		render(<RatingForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

		expect(screen.getByTestId(testIds.rating.form)).toHaveClass(
			"flex",
			"min-h-0",
			"flex-1",
			"flex-col",
			"overflow-hidden",
		);

		expect(screen.getByTestId(testIds.rating.commentTextarea)).toHaveClass(
			"field-sizing-fixed",
			"min-h-32",
			"max-h-[40dvh]",
			"resize-y",
			"overflow-y-auto",
		);

		expect(screen.getByTestId(testIds.rating.commentTextarea)).toHaveAttribute(
			"rows",
			"6",
		);
	});
});

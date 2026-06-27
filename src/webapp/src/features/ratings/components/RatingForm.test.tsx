import { describe, expect, it, vi } from "vitest";

import { testIds } from "@/lib/test-ids";
import { render, screen } from "@/test-utils/render";
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

	describe("instructor field — feature flag gating", () => {
		it("shows the legacy free-text input when the flag is off", () => {
			render(<RatingForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

			expect(
				screen.getByTestId(testIds.rating.instructorInput),
			).toBeInTheDocument();
			expect(
				screen.queryByTestId(testIds.rating.instructorMultiSelect),
			).not.toBeInTheDocument();
		});

		it("shows the multi-select when the flag is on", () => {
			render(<RatingForm onSubmit={vi.fn()} onCancel={vi.fn()} />, {
				flags: { fe_instructor_multiselect: true },
			});

			expect(
				screen.getByTestId(testIds.rating.instructorMultiSelect),
			).toBeInTheDocument();
			expect(
				screen.queryByTestId(testIds.rating.instructorInput),
			).not.toBeInTheDocument();
		});
	});
});

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

		it("shows the previous free-text instructor read-only next to the multi-select", () => {
			render(
				<RatingForm
					onSubmit={vi.fn()}
					onCancel={vi.fn()}
					isEditMode
					initialData={{
						difficulty: 3,
						usefulness: 3,
						comment: "",
						instructor_ids: [],
						instructor: "Сегін",
						is_anonymous: false,
					}}
				/>,
				{ flags: { fe_instructor_multiselect: true } },
			);

			expect(
				screen.getByTestId(testIds.rating.legacyInstructorText),
			).toHaveTextContent("Сегін");
			expect(
				screen.getByTestId(testIds.rating.instructorMultiSelect),
			).toBeInTheDocument();
			// The old value is informational only — it cannot be edited as text.
			expect(
				screen.queryByTestId(testIds.rating.instructorInput),
			).not.toBeInTheDocument();
		});

		it("renders neither variant until the flags resolve", () => {
			render(<RatingForm onSubmit={vi.fn()} onCancel={vi.fn()} />, {
				flagsReady: false,
			});

			expect(
				screen.queryByTestId(testIds.rating.instructorInput),
			).not.toBeInTheDocument();
			expect(
				screen.queryByTestId(testIds.rating.instructorMultiSelect),
			).not.toBeInTheDocument();
		});
	});
});

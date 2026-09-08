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

	describe("instructor field", () => {
		it("shows the multi-select", () => {
			render(<RatingForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

			expect(
				screen.getByTestId(testIds.rating.instructorMultiSelect),
			).toBeInTheDocument();
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
			);

			expect(
				screen.getByTestId(testIds.rating.legacyInstructorText),
			).toHaveTextContent("Сегін");
			expect(
				screen.getByTestId(testIds.rating.instructorMultiSelect),
			).toBeInTheDocument();
		});
	});
});

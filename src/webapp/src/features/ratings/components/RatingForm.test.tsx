import { describe, expect, it, vi } from "vitest";

import { testIds } from "@/lib/test-ids";
import { render, screen } from "@/test-utils/render";
import { RatingForm } from "./RatingForm";
import userEvent from "@testing-library/user-event";

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

	describe("score scales", () => {
		it("shows the chosen value's meaning next to each criterion", () => {
			render(<RatingForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

			expect(screen.getByText("3 — Помірно")).toBeInTheDocument();
			expect(screen.getByText("3 — Достатньо корисно")).toBeInTheDocument();
		});

		it("labels each scale's ends with the app's wording", () => {
			render(<RatingForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

			expect(screen.getByText("Дуже легко")).toBeInTheDocument();
			expect(screen.getByText("Дуже складно")).toBeInTheDocument();
			expect(screen.getByText("Не корисно")).toBeInTheDocument();
			expect(screen.getByText("Надзвичайно корисно")).toBeInTheDocument();
		});

		it("keeps the announced meaning in sync when the score changes", async () => {
			const user = userEvent.setup();
			render(<RatingForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
			await user.click(screen.getAllByRole("radio", { name: "4 з 5" })[0]);
			expect(screen.getAllByText("4 — Складно").length).toBeGreaterThan(0);
		});

		it("submits the chosen scores", async () => {
			const user = userEvent.setup();
			const onSubmit = vi.fn();
			render(<RatingForm onSubmit={onSubmit} onCancel={vi.fn()} />);

			await user.click(screen.getAllByRole("radio", { name: "5 з 5" })[0]);
			await user.click(screen.getAllByRole("radio", { name: "1 з 5" })[1]);
			await user.click(screen.getByTestId(testIds.rating.submitButton));

			expect(onSubmit).toHaveBeenCalled();
			expect(onSubmit.mock.calls[0][0]).toMatchObject({
				difficulty: 5,
				usefulness: 1,
			});
		});
	});
});

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

	describe("score inputs", () => {
		it("labels each star group and shows the chosen value with its meaning", () => {
			render(<RatingForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

			expect(
				screen.getByRole("radiogroup", { name: "Складність" }),
			).toBeInTheDocument();
			expect(
				screen.getByRole("radiogroup", { name: "Корисність" }),
			).toBeInTheDocument();
			expect(screen.getByText("Помірно")).toBeInTheDocument();
			expect(screen.getByText("Достатньо корисно")).toBeInTheDocument();
		});

		it("keeps the announced meaning in sync when the score changes", async () => {
			const user = userEvent.setup();
			render(<RatingForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
			await user.click(screen.getAllByRole("radio", { name: "4 з 5" })[0]);
			expect(screen.getByText("Складно")).toBeInTheDocument();
		});

		it("submits the scores chosen by clicking stars", async () => {
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

		it("changes the score with arrow keys", async () => {
			const user = userEvent.setup();
			const onSubmit = vi.fn();
			render(<RatingForm onSubmit={onSubmit} onCancel={vi.fn()} />);

			screen.getAllByRole("radio", { name: "3 з 5" })[0].focus();
			await user.keyboard("{ArrowRight}");

			expect(
				screen.getAllByRole("radio", { name: "4 з 5" })[0],
			).toHaveAttribute("aria-checked", "true");
			await user.click(screen.getByTestId(testIds.rating.submitButton));
			expect(onSubmit).toHaveBeenCalled();
			expect(onSubmit.mock.calls[0][0]).toMatchObject({
				difficulty: 4,
				usefulness: 3,
			});
		});
	});

	it("previews the review under the author's name, then anonymously", async () => {
		const user = userEvent.setup();
		render(
			<RatingForm
				onSubmit={vi.fn()}
				onCancel={vi.fn()}
				author={{ name: "Коваль Олена" }}
			/>,
		);

		await user.type(
			screen.getByTestId(testIds.rating.commentTextarea),
			"Корисний курс",
		);
		await user.click(screen.getByRole("button", { name: "Як побачать інші" }));
		const preview = screen.getByRole("region", {
			name: "Попередній перегляд відгуку",
		});
		expect(preview).toHaveTextContent("Коваль Олена");
		expect(preview).toHaveTextContent("Корисний курс");

		await user.click(screen.getByTestId(testIds.rating.anonymousCheckbox));
		expect(preview).toHaveTextContent("Анонімний відгук");
		expect(preview).not.toHaveTextContent("Коваль Олена");
	});
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import * as generated from "@/lib/api/generated";
import { createMutationStub } from "@/test-utils/mutation-stub";
import { render } from "@/test-utils/render";
import { RatingModal, type RatingFormData } from "./RatingModal";
import * as RatingFormModule from "./RatingForm";

let mockCreate: ReturnType<typeof vi.spyOn>;
let mockPartialUpdate: ReturnType<typeof vi.spyOn>;
let capturedSubmit:
	| ((data: RatingFormData) => void | Promise<void>)
	| undefined;

const EXISTING = {
	id: "11111111-1111-1111-1111-111111111111",
	difficulty: 3,
	usefulness: 4,
	comment: "",
	instructor: "Сегін",
	instructors: [],
	is_anonymous: false,
};

function formData(over: Partial<RatingFormData>): RatingFormData {
	return {
		difficulty: 3,
		usefulness: 4,
		comment: "",
		instructor_ids: [],
		instructor: "Сегін",
		is_anonymous: false,
		...over,
	};
}

function renderModal(flags: Record<string, boolean>) {
	const mutateAsync = vi.fn().mockResolvedValue({});
	mockPartialUpdate.mockReturnValue(
		// SAFETY: RatingModal only reads mutateAsync and isPending from the result.
		createMutationStub({ mutateAsync }) as ReturnType<
			typeof generated.useCoursesRatingsPartialUpdate
		>,
	);
	mockCreate.mockReturnValue(
		// SAFETY: RatingModal only reads mutateAsync and isPending from the result.
		createMutationStub({
			mutateAsync: vi.fn().mockResolvedValue({}),
		}) as ReturnType<typeof generated.useCoursesRatingsCreate>,
	);

	render(
		<RatingModal
			isOpen
			onClose={vi.fn()}
			courseId="22222222-2222-2222-2222-222222222222"
			existingRating={EXISTING}
		/>,
		{ flags },
	);

	return mutateAsync;
}

describe("RatingModal instructor write path", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		capturedSubmit = undefined;
		mockCreate = vi.spyOn(generated, "useCoursesRatingsCreate");
		mockPartialUpdate = vi.spyOn(generated, "useCoursesRatingsPartialUpdate");
		vi.spyOn(RatingFormModule, "RatingForm").mockImplementation(
			({ onSubmit }) => {
				capturedSubmit = onSubmit;
				return <div data-testid="rating-form-stub" />;
			},
		);
	});

	it("clears the legacy text when instructors are selected with the flag on", async () => {
		const mutateAsync = renderModal({ fe_instructor_multiselect: true });

		await capturedSubmit?.(
			formData({ instructor_ids: ["33333333-3333-3333-3333-333333333333"] }),
		);

		expect(mutateAsync.mock.calls[0][0].data).toMatchObject({
			instructor_ids: ["33333333-3333-3333-3333-333333333333"],
			instructor: "",
		});
	});

	it("leaves the legacy text untouched when nothing is selected", async () => {
		const mutateAsync = renderModal({ fe_instructor_multiselect: true });

		await capturedSubmit?.(formData({ instructor_ids: [] }));

		const { data } = mutateAsync.mock.calls[0][0];
		expect(data.instructor_ids).toEqual([]);
		expect(data).not.toHaveProperty("instructor");
	});

	it("writes only the legacy text when the flag is off", async () => {
		const mutateAsync = renderModal({});

		await capturedSubmit?.(
			formData({ instructor_ids: ["33333333-3333-3333-3333-333333333333"] }),
		);

		const { data } = mutateAsync.mock.calls[0][0];
		expect(data.instructor).toBe("Сегін");
		expect(data).not.toHaveProperty("instructor_ids");
	});
});

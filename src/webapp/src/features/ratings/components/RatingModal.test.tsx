import { describe, expect, it, vi } from "vitest";

import {
	useCoursesRatingsCreate,
	useCoursesRatingsPartialUpdate,
} from "@/lib/api/generated";
import { render } from "@/test-utils/render";
import { RatingModal, type RatingFormData } from "./RatingModal";

vi.mock("@/lib/api/generated", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/api/generated")>();

	return {
		...actual,
		useCoursesRatingsCreate: vi.fn(),
		useCoursesRatingsPartialUpdate: vi.fn(),
	};
});

let capturedSubmit: ((data: RatingFormData) => Promise<void>) | undefined;

vi.mock("./RatingForm", () => {
	return {
		RatingForm: ({
			onSubmit,
		}: {
			onSubmit: (data: RatingFormData) => Promise<void>;
		}) => {
			capturedSubmit = onSubmit;
			return <div data-testid="rating-form-stub" />;
		},
	};
});

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
	vi.mocked(useCoursesRatingsPartialUpdate).mockReturnValue({
		mutateAsync,
		isPending: false,
	} as unknown as ReturnType<typeof useCoursesRatingsPartialUpdate>);
	vi.mocked(useCoursesRatingsCreate).mockReturnValue({
		mutateAsync: vi.fn().mockResolvedValue({}),
		isPending: false,
	} as unknown as ReturnType<typeof useCoursesRatingsCreate>);

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

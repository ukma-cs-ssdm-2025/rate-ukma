import { describe, expect, it, vi } from "vitest";

import {
	useCoursesRatingsCreate,
	useCoursesRatingsPartialUpdate,
} from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { render, screen } from "@/test-utils/render";
import { RatingContinuationContext } from "../RatingContinuationContext";
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

function renderModal() {
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
			courseName="Алгоритми та структури даних"
			existingRating={EXISTING}
		/>,
	);

	return mutateAsync;
}

function renderModalWithoutCourseName() {
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
	);

	return mutateAsync;
}

describe("RatingModal instructor write path", () => {
	it("clears the legacy text when instructors are selected", async () => {
		const mutateAsync = renderModal();

		await capturedSubmit?.(
			formData({ instructor_ids: ["33333333-3333-3333-3333-333333333333"] }),
		);

		expect(mutateAsync.mock.calls[0][0].data).toMatchObject({
			instructor_ids: ["33333333-3333-3333-3333-333333333333"],
			instructor: "",
		});
	});

	it("leaves the legacy text untouched when nothing is selected", async () => {
		const mutateAsync = renderModal();

		await capturedSubmit?.(formData({ instructor_ids: [] }));

		const { data } = mutateAsync.mock.calls[0][0];
		expect(data.instructor_ids).toEqual([]);
		expect(data).not.toHaveProperty("instructor");
	});
});

describe("RatingModal title", () => {
	it("uses the course name as the dialog title", () => {
		renderModal();

		expect(screen.getByTestId(testIds.rating.modalTitle)).toHaveTextContent(
			"Алгоритми та структури даних",
		);
	});

	it("falls back to the generic title when the course name is missing", () => {
		renderModalWithoutCourseName();

		expect(screen.getByTestId(testIds.rating.modalTitle)).toHaveTextContent(
			"Редагувати оцінку",
		);
	});
});

describe("RatingModal new-rating continuation behind fe_rate_flow", () => {
	function renderCreate(flags: Record<string, boolean>, flagsReady = true) {
		vi.mocked(useCoursesRatingsPartialUpdate).mockReturnValue({
			mutateAsync: vi.fn(),
			isPending: false,
		} as unknown as ReturnType<typeof useCoursesRatingsPartialUpdate>);
		vi.mocked(useCoursesRatingsCreate).mockReturnValue({
			mutateAsync: vi.fn().mockResolvedValue({}),
			isPending: false,
		} as unknown as ReturnType<typeof useCoursesRatingsCreate>);
		const complete = vi.fn();
		const onClose = vi.fn();
		const onSuccess = vi.fn();
		render(
			<RatingContinuationContext.Provider
				value={{
					complete,
					followUp: null,
					beginFollowUp: vi.fn(),
					cancelFollowUp: vi.fn(),
				}}
			>
				<RatingModal
					isOpen
					onClose={onClose}
					onSuccess={onSuccess}
					courseId="22222222-2222-2222-2222-222222222222"
					offeringId="44444444-4444-4444-4444-444444444444"
				/>
			</RatingContinuationContext.Provider>,
			{ flags, flagsReady },
		);
		return { complete, onClose, onSuccess };
	}

	it("hands the saved rating to the continuation when the flag is on", async () => {
		const { complete, onClose } = renderCreate({ fe_rate_flow: true });

		await capturedSubmit?.(formData({ is_anonymous: true }));

		expect(complete).toHaveBeenCalledWith(
			{
				courseId: "22222222-2222-2222-2222-222222222222",
				isAnonymous: true,
			},
			true,
		);
		expect(onClose).toHaveBeenCalled();
	});

	it.each([
		["off", { fe_rate_flow: false }, true],
		["unresolved", { fe_rate_flow: true }, false],
	])(
		"saves and closes without a continuation when the flag is %s",
		async (_name, flags, flagsReady) => {
			const { complete, onClose, onSuccess } = renderCreate(flags, flagsReady);

			await capturedSubmit?.(formData({}));

			expect(complete).not.toHaveBeenCalled();
			expect(onSuccess).toHaveBeenCalled();
			expect(onClose).toHaveBeenCalled();
		},
	);
});

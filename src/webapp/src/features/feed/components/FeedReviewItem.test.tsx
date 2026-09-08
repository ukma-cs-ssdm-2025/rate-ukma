import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithRouter } from "@/test-utils/router";
import type { FeedReviewItem as FeedReviewItemType } from "../feedTypes";
import { FeedReviewItem } from "./FeedReviewItem";

const baseItem: FeedReviewItemType = {
	kind: "review",
	id: "r1",
	createdAt: new Date().toISOString(),
	courseId: "course-1",
	courseTitle: "Алгоритми та структури даних",
	difficulty: 4.2,
	usefulness: 4.8,
	comment: "Складно, але корисно.",
	courseAvgDifficulty: 4.2,
	courseAvgUsefulness: 4.8,
	semesterYear: 2025,
	semesterTerm: "FALL",
};

describe("FeedReviewItem", () => {
	it("leads with the course as a link to the course page", async () => {
		await renderWithRouter(<FeedReviewItem item={baseItem} />);

		expect(screen.getByText(/Новий відгук на/)).toBeInTheDocument();
		const link = screen.getByRole("link", {
			name: "Алгоритми та структури даних",
		});
		expect(link).toHaveAttribute("href", "/courses/course-1");
	});

	it("shows an arrow when the score differs from the course average", async () => {
		await renderWithRouter(
			<FeedReviewItem
				item={{ ...baseItem, difficulty: 5, courseAvgDifficulty: 3 }}
			/>,
		);

		expect(screen.getByLabelText(/вище за середнє/)).toBeInTheDocument();
	});

	it("shows no arrow when the score matches the course average", async () => {
		// A course whose only rating is this one ties by construction, so an
		// arrow here would be arbitrary.
		await renderWithRouter(
			<FeedReviewItem
				item={{
					...baseItem,
					difficulty: 4,
					usefulness: 4,
					courseAvgDifficulty: 4,
					courseAvgUsefulness: 4,
				}}
			/>,
		);

		expect(screen.queryByLabelText(/за середнє/)).not.toBeInTheDocument();
	});

	it("renders difficulty, usefulness and the comment", async () => {
		await renderWithRouter(<FeedReviewItem item={baseItem} />);

		expect(screen.getByText("4.2")).toBeInTheDocument();
		expect(screen.getByText("4.8")).toBeInTheDocument();
		expect(screen.getByText("Складно, але корисно.")).toBeInTheDocument();
	});

	it("omits the comment paragraph when there is no comment", async () => {
		await renderWithRouter(
			<FeedReviewItem item={{ ...baseItem, comment: "" }} />,
		);

		expect(screen.queryByText("Складно, але корисно.")).not.toBeInTheDocument();
	});
});

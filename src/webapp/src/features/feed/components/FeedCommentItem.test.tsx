import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithRouter } from "@/test-utils/router";
import type { FeedCommentItem as FeedCommentItemType } from "../feedTypes";
import { FeedCommentItem } from "./FeedCommentItem";

const baseItem: FeedCommentItemType = {
	kind: "comment",
	id: "comment-8c3f",
	createdAt: new Date().toISOString(),
	ratingId: "rating-4d1a",
	courseId: "course-b7e2",
	courseTitle: "Алгоритми та структури даних",
	content: "Погоджуюсь, лабораторні справді важкі.",
};

describe("FeedCommentItem", () => {
	it("leads with the course as a link to the course page", async () => {
		await renderWithRouter(<FeedCommentItem item={baseItem} />);

		expect(
			screen.getByText(/Новий коментар до відгуку на/),
		).toBeInTheDocument();
		const link = screen.getByRole("link", {
			name: "Алгоритми та структури даних",
		});
		expect(link).toHaveAttribute("href", "/courses/course-b7e2");
	});

	it("renders the comment text", async () => {
		await renderWithRouter(<FeedCommentItem item={baseItem} />);

		expect(
			screen.getByText("Погоджуюсь, лабораторні справді важкі."),
		).toBeInTheDocument();
	});
});

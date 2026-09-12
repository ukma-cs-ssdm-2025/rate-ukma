import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FeedCommentItem as FeedCommentItemType } from "../feedTypes";
import { FeedCommentItem } from "./FeedCommentItem";

vi.mock("@tanstack/react-router", async () => ({
	...(await vi.importActual("@tanstack/react-router")),
	Link: (await import("@/test-utils/router")).MockLink,
}));

const baseItem: FeedCommentItemType = {
	kind: "comment",
	id: "c1",
	createdAt: new Date().toISOString(),
	ratingId: "rating-1",
	courseId: "course-1",
	courseTitle: "Алгоритми та структури даних",
	content: "Погоджуюсь, лабораторні справді важкі.",
};

describe("FeedCommentItem", () => {
	it("leads with the course as a link to the course page", () => {
		render(<FeedCommentItem item={baseItem} />);

		expect(
			screen.getByText(/Новий коментар до відгуку на/),
		).toBeInTheDocument();
		const link = screen.getByRole("link", {
			name: "Алгоритми та структури даних",
		});
		expect(link).toHaveAttribute("href", "/courses/$courseId");
		expect(link).toHaveAttribute(
			"data-params",
			JSON.stringify({ courseId: "course-1" }),
		);
	});

	it("renders the comment text", () => {
		render(<FeedCommentItem item={baseItem} />);

		expect(
			screen.getByText("Погоджуюсь, лабораторні справді важкі."),
		).toBeInTheDocument();
	});
});

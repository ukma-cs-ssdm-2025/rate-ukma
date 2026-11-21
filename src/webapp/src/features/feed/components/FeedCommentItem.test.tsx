import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FeedCommentItem as FeedCommentItemType } from "@/lib/api/generated";
import { FeedCommentItem } from "./FeedCommentItem";

vi.mock("@tanstack/react-router", async () => ({
	...(await vi.importActual("@tanstack/react-router")),
	Link: (await import("@/test-utils/router")).MockLink,
}));

const baseItem: FeedCommentItemType = {
	kind: "comment",
	id: "c1",
	occurred_at: new Date().toISOString(),
	rating_id: "rating-1",
	course_id: "course-1",
	course_title: "Алгоритми та структури даних",
	content: "Погоджуюсь, лабораторні справді важкі.",
};

describe("FeedCommentItem", () => {
	it("leads with the course as a link to the course page", () => {
		render(<FeedCommentItem item={baseItem} />);

		expect(screen.getByText("Коментар")).toBeInTheDocument();
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

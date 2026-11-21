import { formatRelativeTime } from "@/features/notifications/notificationFormatting";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FeedReviewItem as FeedReviewItemType } from "@/lib/api/generated";
import { FeedReviewItem } from "./FeedReviewItem";

vi.mock("@tanstack/react-router", async () => ({
	...(await vi.importActual("@tanstack/react-router")),
	Link: (await import("@/test-utils/router")).MockLink,
}));

const baseItem: FeedReviewItemType = {
	kind: "review",
	id: "r1",
	occurred_at: new Date().toISOString(),
	course_id: "course-1",
	course_title: "Алгоритми та структури даних",
	difficulty: 4.2,
	usefulness: 4.8,
	comment: "Складно, але корисно.",
	course_avg_difficulty: 4.2,
	course_avg_usefulness: 4.8,
	semester_year: 2025,
	semester_term: "FALL",
};

describe("FeedReviewItem", () => {
	it("leads with the course as a link to the course page", () => {
		render(<FeedReviewItem item={baseItem} />);

		expect(screen.getByText("Відгук")).toBeInTheDocument();
		const link = screen.getByRole("link", {
			name: "Алгоритми та структури даних",
		});
		expect(link).toHaveAttribute("href", "/courses/$courseId");
		expect(link).toHaveAttribute(
			"data-params",
			JSON.stringify({ courseId: "course-1" }),
		);
	});

	it("shows an arrow when the score differs from the course average", () => {
		render(
			<FeedReviewItem
				item={{ ...baseItem, difficulty: 5, course_avg_difficulty: 3 }}
			/>,
		);

		expect(screen.getByLabelText(/вище за середнє/)).toBeInTheDocument();
	});

	it("shows no arrow when the score matches the course average", () => {
		// A course whose only rating is this one ties by construction, so an
		// arrow here would be arbitrary.
		render(
			<FeedReviewItem
				item={{
					...baseItem,
					difficulty: 4,
					usefulness: 4,
					course_avg_difficulty: 4,
					course_avg_usefulness: 4,
				}}
			/>,
		);

		expect(screen.queryByLabelText(/за середнє/)).not.toBeInTheDocument();
	});

	it("renders difficulty, usefulness and the comment on the /feed banner", () => {
		render(<FeedReviewItem item={baseItem} variant="banner" />);

		expect(screen.getByText("4.2")).toBeInTheDocument();
		expect(screen.getByText("4.8")).toBeInTheDocument();
		expect(screen.getByText("Складно, але корисно.")).toBeInTheDocument();
	});

	it("gives the strip tile the review text and keeps the scores", () => {
		render(<FeedReviewItem item={baseItem} />);

		expect(screen.getByText("Складно, але корисно.")).toBeInTheDocument();
		expect(screen.getByText("4.2")).toBeInTheDocument();
		expect(screen.getByText("4.8")).toBeInTheDocument();
	});

	it("falls back to scores and time in the strip tile without review text", () => {
		render(<FeedReviewItem item={{ ...baseItem, comment: "" }} />);

		expect(screen.getByText("4.2")).toBeInTheDocument();
		expect(
			screen.getByText(formatRelativeTime(baseItem.occurred_at)),
		).toBeInTheDocument();
	});
});

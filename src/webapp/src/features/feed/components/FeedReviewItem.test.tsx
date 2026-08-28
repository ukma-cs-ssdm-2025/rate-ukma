import type { ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FeedReviewItem as FeedReviewItemType } from "../feedTypes";
import { FeedReviewItem } from "./FeedReviewItem";

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return {
		...actual,
		Link: ({
			to,
			params,
			children,
			className,
		}: {
			to: string;
			params?: Record<string, string>;
			children: ReactNode;
			className?: string;
		}) => (
			<a href={to} data-params={JSON.stringify(params)} className={className}>
				{children}
			</a>
		),
	};
});

const baseItem: FeedReviewItemType = {
	kind: "review",
	id: "r1",
	createdAt: new Date().toISOString(),
	courseId: "course-1",
	courseTitle: "Алгоритми та структури даних",
	studentName: "Олена Ковальчук",
	isAnonymous: false,
	difficulty: 4.2,
	usefulness: 4.8,
	comment: "Складно, але корисно.",
	semesterYear: 2025,
	semesterTerm: "FALL",
};

describe("FeedReviewItem", () => {
	it("leads with the course as a link to the course page", () => {
		render(<FeedReviewItem item={baseItem} />);

		expect(screen.getByText(/Новий відгук на/)).toBeInTheDocument();
		const link = screen.getByRole("link", {
			name: "Алгоритми та структури даних",
		});
		expect(link).toHaveAttribute("href", "/courses/$courseId");
		expect(link).toHaveAttribute(
			"data-params",
			JSON.stringify({ courseId: "course-1" }),
		);
	});

	it("does not show the student name, even when the review is not anonymous", () => {
		render(
			<FeedReviewItem
				item={{ ...baseItem, isAnonymous: false, studentName: "Іван Петренко" }}
			/>,
		);

		expect(screen.queryByText(/Олена Ковальчук/)).not.toBeInTheDocument();
		expect(screen.queryByText(/Іван Петренко/)).not.toBeInTheDocument();
	});

	it("renders difficulty, usefulness and the comment", () => {
		render(<FeedReviewItem item={baseItem} />);

		expect(screen.getByText("4.2")).toBeInTheDocument();
		expect(screen.getByText("4.8")).toBeInTheDocument();
		expect(screen.getByText("Складно, але корисно.")).toBeInTheDocument();
	});

	it("omits the comment paragraph when there is no comment", () => {
		render(<FeedReviewItem item={{ ...baseItem, comment: null }} />);

		expect(screen.queryByText("Складно, але корисно.")).not.toBeInTheDocument();
	});
});

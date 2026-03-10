import type { ReactNode } from "react";

import { render, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUserCourseRating } from "@/features/ratings/hooks/useUserCourseRating";
import {
	useCoursesOfferingsList,
	useCoursesRetrieve,
} from "@/lib/api/generated";
import { AppMetadataDefaults, DEFAULT_PAGE_TITLE } from "@/lib/app-metadata";
import { Route } from "./courses.$courseId";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: object) => ({
		...options,
		useParams: () => ({ courseId: "course-1" }),
	}),
}));

vi.mock("@/components/Layout", () => ({
	default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/ExpandableText", () => ({
	ExpandableText: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/Skeleton", () => ({
	Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock("@/features/course-offerings/components/CourseCazYearsSection", () => ({
	CourseCazYearsSection: () => <div data-testid="course-offerings" />,
	getLatestOfferingMeta: vi.fn(() => []),
}));

vi.mock("@/features/courses/components/CourseDetailsHeader", () => ({
	CourseDetailsHeader: ({ title }: { title: string }) => (
		<div data-testid="course-header">{title}</div>
	),
	CourseDetailsHeaderSkeleton: () => (
		<div data-testid="course-header-skeleton" />
	),
}));

vi.mock("@/features/courses/components/CourseStatsCards", () => ({
	CourseStatsHero: () => <div data-testid="course-stats" />,
	CourseStatsHeroSkeleton: () => <div data-testid="course-stats-skeleton" />,
}));

vi.mock("@/features/ratings/components/CourseRatingsList", () => ({
	CourseRatingsList: () => <div data-testid="course-ratings" />,
	CourseRatingsListSkeleton: () => (
		<div data-testid="course-ratings-skeleton" />
	),
}));

vi.mock("@/features/ratings/components/DeleteRatingDialog", () => ({
	DeleteRatingDialog: () => null,
}));

vi.mock("@/features/ratings/components/RatingModal", () => ({
	RatingModal: () => null,
}));

vi.mock("@/lib/auth", () => ({
	withAuth: <P extends object>(Component: React.ComponentType<P>) => Component,
}));

vi.mock("@/lib/api/generated", () => ({
	useCoursesRetrieve: vi.fn(),
	useCoursesOfferingsList: vi.fn(),
}));

vi.mock("@/features/ratings/hooks/useUserCourseRating", () => ({
	useUserCourseRating: vi.fn(),
}));

describe("CourseDetailsRoute", () => {
	const CourseDetailsRouteComponent = (
		Route as unknown as {
			component: React.ComponentType;
		}
	).component;
	const renderWithMetadata = (showCourse = true) =>
		render(
			<HelmetProvider>
				<AppMetadataDefaults />
				{showCourse ? <CourseDetailsRouteComponent /> : null}
			</HelmetProvider>,
		);

	beforeEach(() => {
		document.title = DEFAULT_PAGE_TITLE;

		vi.mocked(useCoursesRetrieve).mockReturnValue({
			data: {
				title: "Основи фреймворків",
				specialities: [],
				department_name: "",
				faculty_name: "",
				description: "",
				avg_difficulty: null,
				avg_usefulness: null,
				ratings_count: null,
			},
			isLoading: false,
			isError: false,
		} as unknown as ReturnType<typeof useCoursesRetrieve>);

		vi.mocked(useCoursesOfferingsList).mockReturnValue({
			data: {
				course_offerings: [],
			},
			isLoading: false,
			isError: false,
		} as unknown as ReturnType<typeof useCoursesOfferingsList>);

		vi.mocked(useUserCourseRating).mockReturnValue({
			rating: null,
			ratingId: null,
			ratedOffering: null,
			hasAttendedCourse: false,
			selectedOffering: null,
			attendedCourseId: null,
			isLoading: false,
		} as unknown as ReturnType<typeof useUserCourseRating>);
	});

	it("sets the document title to the course title", async () => {
		renderWithMetadata();

		await waitFor(() => {
			expect(document.title).toBe("Основи фреймворків | Rate UKMA");
		});
	});

	it("restores the default title when the page unmounts", async () => {
		const { rerender } = renderWithMetadata();

		await waitFor(() => {
			expect(document.title).toBe("Основи фреймворків | Rate UKMA");
		});

		rerender(
			<HelmetProvider>
				<AppMetadataDefaults />
			</HelmetProvider>,
		);

		expect(document.title).toBe(DEFAULT_PAGE_TITLE);
	});
});

import { QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as LayoutModule from "@/components/Layout";
import * as SkeletonModule from "@/components/ui/Skeleton";
import * as ExpandableTextModule from "@/components/ui/ExpandableText";
import * as CazModule from "@/features/course-offerings/components/CourseCazYearsSection";
import * as HeaderModule from "@/features/courses/components/CourseDetailsHeader";
import * as StatsModule from "@/features/courses/components/CourseStatsCards";
import * as RatingsListModule from "@/features/ratings/components/CourseRatingsList";
import * as DeleteDialogModule from "@/features/ratings/components/DeleteRatingDialog";
import * as RatingModalModule from "@/features/ratings/components/RatingModal";
import * as useUserCourseRatingModule from "@/features/ratings/hooks/useUserCourseRating";
import { AppMetadataDefaults, DEFAULT_PAGE_TITLE } from "@/lib/app-metadata";
import * as generated from "@/lib/api/generated";
import * as useAuthModule from "@/lib/auth/useAuth";
import { createQueryStub } from "@/test-utils/query-stub";
import { createTestQueryClient } from "@/test-utils/render";
import { Route as CoursesCourseIdRoute } from "./courses.$courseId";

const COURSE = {
	title: "Основи фреймворків",
	specialities: [],
	department_name: "",
	faculty_name: "",
	description: "",
	avg_difficulty: null,
	avg_usefulness: null,
	ratings_count: null,
};

const USER_RATING = {
	rating: null,
	ratingId: undefined,
	ratedOffering: null,
	attendedOfferings: [],
	hasAttendedCourse: false,
	selectedOffering: null,
	attendedCourseId: undefined,
	isLoading: false,
};

/**
 * Render the real course route in a minimal memory router, without the app
 * shell (auth/flags/nuqs providers) that the generated root route mounts.
 */
async function renderCourseRoute() {
	const rootRoute = createRootRoute({
		component: () => (
			<HelmetProvider>
				<AppMetadataDefaults />
				<Outlet />
			</HelmetProvider>
		),
	});
	// SAFETY: update() accepts the same route options the generated tree passes.
	const courseRoute = CoursesCourseIdRoute.update({
		id: "/courses/$courseId",
		path: "/courses/$courseId",
		getParentRoute: () => rootRoute,
	} as never);
	const router = createRouter({
		routeTree: rootRoute.addChildren([courseRoute]),
		history: createMemoryHistory({ initialEntries: ["/courses/course-1"] }),
	});
	await router.load();
	const queryClient = createTestQueryClient();
	return render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
}

describe("CourseDetailsRoute", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		document.title = DEFAULT_PAGE_TITLE;

		vi.spyOn(LayoutModule, "default").mockImplementation(({ children }) => (
			<>{children}</>
		));
		vi.spyOn(ExpandableTextModule, "ExpandableText").mockImplementation(
			({ children }) => <>{children}</>,
		);
		vi.spyOn(SkeletonModule, "Skeleton").mockImplementation(() => (
			<div data-testid="skeleton" />
		));
		vi.spyOn(CazModule, "CourseCazYearsSection").mockImplementation(() => (
			<div data-testid="course-offerings" />
		));
		vi.spyOn(CazModule, "getLatestOfferingMeta").mockReturnValue([]);
		vi.spyOn(HeaderModule, "CourseDetailsHeader").mockImplementation(
			({ title }: { title: string }) => (
				<div data-testid="course-header">{title}</div>
			),
		);
		vi.spyOn(HeaderModule, "CourseDetailsHeaderSkeleton").mockImplementation(
			() => <div data-testid="course-header-skeleton" />,
		);
		vi.spyOn(StatsModule, "CourseStatsHero").mockImplementation(() => (
			<div data-testid="course-stats" />
		));
		vi.spyOn(StatsModule, "CourseStatsHeroSkeleton").mockImplementation(() => (
			<div data-testid="course-stats-skeleton" />
		));
		vi.spyOn(RatingsListModule, "CourseRatingsList").mockImplementation(() => (
			<div data-testid="course-ratings" />
		));
		vi.spyOn(RatingsListModule, "CourseRatingsListSkeleton").mockImplementation(
			() => <div data-testid="course-ratings-skeleton" />,
		);
		vi.spyOn(DeleteDialogModule, "DeleteRatingDialog").mockReturnValue(<></>);
		vi.spyOn(RatingModalModule, "RatingModal").mockReturnValue(<></>);

		vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
			status: "authenticated",
			user: { id: 1 },
			sessionExpired: false,
			isStudent: true,
			loginWithMicrosoft: vi.fn(),
			loginWithDjango: vi.fn(() => Promise.resolve()),
			logout: vi.fn(() => Promise.resolve()),
			checkAuth: vi.fn(),
		});

		vi.spyOn(generated, "useCoursesRetrieve").mockReturnValue(
			// SAFETY: the route only reads data/isLoading/isError from this query.
			createQueryStub(COURSE) as ReturnType<
				typeof generated.useCoursesRetrieve
			>,
		);
		vi.spyOn(generated, "useCoursesOfferingsList").mockReturnValue(
			// SAFETY: the route only reads data/isLoading/isError from this query.
			createQueryStub({ course_offerings: [] }) as ReturnType<
				typeof generated.useCoursesOfferingsList
			>,
		);
		vi.spyOn(useUserCourseRatingModule, "useUserCourseRating").mockReturnValue(
			// SAFETY: the route only reads the fields USER_RATING provides.
			USER_RATING as ReturnType<
				typeof useUserCourseRatingModule.useUserCourseRating
			>,
		);
	});

	it("sets the document title to the course title", async () => {
		await renderCourseRoute();

		await waitFor(() => {
			expect(document.title).toBe("Основи фреймворків | Rate UKMA");
		});
		expect(screen.getByTestId("course-header")).toBeInTheDocument();
	});

	it("restores the default title when the page unmounts", async () => {
		const { unmount } = await renderCourseRoute();

		await waitFor(() => {
			expect(document.title).toBe("Основи фреймворків | Rate UKMA");
		});

		unmount();

		expect(document.title).toBe(DEFAULT_PAGE_TITLE);
	});
});

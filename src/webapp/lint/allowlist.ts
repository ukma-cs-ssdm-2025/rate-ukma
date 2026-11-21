export const LINT_ALLOWLIST = {
	"max-lines": [
		"src/components/AuthShell.tsx",
		"src/features/courses/components/CourseFiltersPanel.tsx",
		"src/features/courses/components/CoursesScatterPlot.tsx",
		"src/features/courses/components/CoursesTable.tsx",
		"src/features/courses/hooks/useCourseFiltersData.ts",
		"src/features/ratings/components/RatingComments.tsx",
		"src/features/ratings/components/RatingForm.tsx",
	],
	"no-restricted-imports": [
		"src/components/Header/Header.tsx",
		"src/components/Header/MobileMenu.tsx",
		"src/features/courses/components/CourseStatsCards.tsx",
		"src/routes/connection-error.tsx",
		"src/routes/courses.$courseId.tsx",
		"src/routes/data.cases.$caseId.tsx",
		"src/routes/data.cases.index.tsx",
		"src/routes/data.index.tsx",
		"src/routes/explore.tsx",
		"src/routes/my-ratings.tsx",
	],
} satisfies Record<string, string[]>;

export const INDEX_FILE_ALLOWLIST = [
	"src/lib/auth/index.ts",
	"src/lib/feature-flags/index.ts",
];

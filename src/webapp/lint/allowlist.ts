export const LINT_ALLOWLIST = {
	"max-lines": [
		"src/features/courses/components/CoursesScatterPlot.tsx",
		"src/features/courses/components/CoursesTable.tsx",
		"src/features/ratings/components/RatingComments.tsx",
		"src/features/ratings/components/RatingForm.tsx",
	],
} satisfies Record<string, string[]>;

export const INDEX_FILE_ALLOWLIST = [
	"src/lib/auth/index.ts",
	"src/lib/feature-flags/index.ts",
];

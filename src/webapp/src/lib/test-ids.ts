export function getTestId(...parts: string[]): string {
	return parts.filter(Boolean).join("-");
}

function toCamelCase(str: string): string {
	return str.replaceAll(/-([a-zA-Z])/g, (_match: string, char: string) =>
		char.toUpperCase(),
	);
}

export function createTestIds<T extends string>(
	prefix: string,
	ids: readonly T[],
): Record<string, string> {
	return Object.fromEntries(
		ids.map((id) => [toCamelCase(id), getTestId(prefix, id)]),
	);
}

export const testIds = {
	login: {
		microsoftButton: "login-microsoft-button",
		form: "login-form",
		usernameInput: "login-username-input",
		passwordInput: "login-password-input",
		submitButton: "login-submit-button",
		backButton: "login-back-button",
		togglePasswordButton: "login-toggle-password-button",
		errorMessage: "login-error-message",
	},

	authShell: {
		dot: "auth-shell-dot",
		tooltip: "auth-shell-tooltip",
	},

	header: {
		root: "header",
		logo: "header-logo",
		nav: "header-nav",
		mobileMenuButton: "header-mobile-menu-button",
		mobileMenu: "header-mobile-menu",
		mobileMenuCloseButton: "header-mobile-menu-close-button",
		themeToggle: "header-theme-toggle",
		userMenu: "header-user-menu",
		userMenuTrigger: "header-user-menu-trigger",
		logoutButton: "header-logout-button",
	},

	courses: {
		searchInput: "courses-search-input",
		table: "courses-table",
		tableRow: "courses-table-row",
		tableTitleLink: "courses-table-title-link",
		difficultySortButtonDesktop: "courses-difficulty-sort-button-desktop",
		difficultySortButtonMobile: "courses-difficulty-sort-button-mobile",
		usefulnessSortButtonDesktop: "courses-usefulness-sort-button-desktop",
		usefulnessSortButtonMobile: "courses-usefulness-sort-button-mobile",
		scatterPlot: "courses-scatter-plot",
		scatterPlotFullscreenButton: "courses-scatter-plot-fullscreen-button",
		emptyState: "courses-empty-state",
		errorState: "courses-error-state",
		retryButton: "courses-retry-button",
	},

	filters: {
		panel: "filters-panel",
		drawer: "filters-drawer",
		drawerTrigger: "filters-drawer-trigger",
		drawerCloseButton: "filters-drawer-close-button",
		resetButton: "filters-reset-button",
		presetsSection: "filters-presets-section",
		presetButton: "filters-preset-button",
		groupRating: "filters-group-rating",
		groupSemester: "filters-group-semester",
		groupStructure: "filters-group-structure",
		difficultySlider: "filters-difficulty-slider",
		usefulnessSlider: "filters-usefulness-slider",
		termToggle: "filters-term-toggle",
		yearSelect: "filters-year-select",
		creditsSelect: "filters-credits-select",
		facultySelect: "filters-faculty-select",
		departmentSelect: "filters-department-select",
		specialitySelect: "filters-speciality-select",
		typeSelect: "filters-type-select",
		instructorSelect: "filters-instructor-select",
		educationLevelToggle: "filters-education-level-toggle",
	},

	courseDetails: {
		title: "course-details-title",
		teachers: "course-details-teachers",
		rateButton: "course-details-rate-button",
		editUserRatingButton: "course-details-edit-user-rating-button",
		statsCards: "course-details-stats-cards",
		ratingsCountStat: "course-details-ratings-count-stat",
		reviewsSection: "course-details-reviews-section",
		reviewCard: "course-details-review-card",
		noReviewsMessage: "course-details-no-reviews-message",
	},

	rating: {
		modal: "rating-modal",
		modalTitle: "rating-modal-title",
		form: "rating-form",
		difficultySlider: "rating-difficulty-slider",
		usefulnessSlider: "rating-usefulness-slider",
		commentTextarea: "rating-comment-textarea",
		instructorMultiSelect: "rating-instructor-multiselect",
		instructorQuickPicks: "rating-instructor-quick-picks",
		legacyInstructorText: "rating-legacy-instructor-text",
		anonymousCheckbox: "rating-anonymous-checkbox",
		submitButton: "rating-submit-button",
		cancelButton: "rating-cancel-button",
		deleteButton: "rating-delete-button",
	},

	comments: {
		toggleButton: "rating-comments-toggle-button",
		item: "rating-comments-item",
		controls: "rating-comments-controls",
		form: "rating-comments-form",
		textarea: "rating-comments-textarea",
		anonymousCheckbox: "rating-comments-anonymous-checkbox",
		submitButton: "rating-comments-submit-button",
		editButton: "rating-comments-edit-button",
		deleteButton: "rating-comments-delete-button",
	},

	deleteDialog: {
		root: "delete-dialog",
		confirmButton: "delete-dialog-confirm-button",
		cancelButton: "delete-dialog-cancel-button",
	},

	myRatings: {
		header: "my-ratings-header",
		list: "my-ratings-list",
		card: "my-ratings-card",
		courseTitleLink: "my-ratings-course-title-link",
		coursePageLink: "my-ratings-course-page-link",
		semesterTrigger: "my-ratings-semester-trigger",
		leaveReviewLink: "my-ratings-leave-review-link",
		editButton: "my-ratings-edit-button",
		deleteButton: "my-ratings-delete-button",
		emptyState: "my-ratings-empty-state",
		errorState: "my-ratings-error-state",
	},

	feed: {
		list: "feed-list",
		skeleton: "feed-skeleton",
		emptyState: "feed-empty-state",
		errorState: "feed-error-state",
		retryButton: "feed-retry-button",
		unavailableState: "feed-unavailable-state",
	},

	notifications: {
		bellTrigger: "notifications-bell-trigger",
		panel: "notifications-panel",
		markReadButton: "notifications-mark-read-button",
		list: "notifications-list",
		item: "notifications-item",
		loading: "notifications-loading",
		empty: "notifications-empty",
		error: "notifications-error",
		loadMore: "notifications-load-more",
		mobileRow: "notifications-mobile-row",
		mobilePanel: "notifications-mobile-panel",
	},

	promo: {
		banner: "promo-banner",
		link: "promo-banner-link",
		dismissButton: "promo-banner-dismiss-button",
	},

	footer: {
		repoLink: "footer-repo-link",
	},

	common: {
		loadingSpinner: "loading-spinner",
		infiniteScrollLoader: "infinite-scroll-loader",
		pagination: "pagination",
		paginationLabel: "pagination-label",
		paginationFirst: "pagination-first-button",
		paginationPrevious: "pagination-previous-button",
		paginationNext: "pagination-next-button",
		paginationLast: "pagination-last-button",
	},
} as const;

export type TestIdKeys<T extends keyof typeof testIds> =
	keyof (typeof testIds)[T];

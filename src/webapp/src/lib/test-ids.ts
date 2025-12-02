/**
 * Test ID utilities for E2E testing
 *
 * This module provides helpers for creating consistent data-testid attributes
 * throughout the application to support reliable E2E tests.
 *
 * Convention:
 * - Use kebab-case: `course-filters-panel`
 * - End with element type suffix: `-button`, `-input`, `-modal`, etc.
 * - Keep IDs stable and semantic (avoid dynamic/internal values)
 * - Structure: `<feature>-<component>-<element>-<type>`
 *
 * @example
 * // Creating test IDs
 * const testIds = createTestIds('rating-form', ['submit-button', 'cancel-button', 'comment-input']);
 * // Result: { submitButton: 'rating-form-submit-button', cancelButton: 'rating-form-cancel-button', ... }
 *
 * // Using in components
 * <Button data-testid={testIds.submitButton}>Submit</Button>
 *
 * // Using getTestId helper for simple cases
 * <Input data-testid={getTestId('search', 'input')} />
 */

/**
 * Creates a test ID string from component and element parts
 */
export function getTestId(...parts: string[]): string {
	return parts.filter(Boolean).join("-");
}

/**
 * Transforms kebab-case to camelCase for object keys
 */
function toCamelCase(str: string): string {
	return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

/**
 * Creates a typed object of test IDs for a component
 *
 * @param prefix - Component prefix (e.g., 'rating-form', 'course-table')
 * @param ids - Array of element identifiers in kebab-case
 * @returns Object with camelCase keys mapping to full test ID strings
 *
 * @example
 * const testIds = createTestIds('login', ['submit-button', 'email-input']);
 * // Returns: { submitButton: 'login-submit-button', emailInput: 'login-email-input' }
 */
export function createTestIds<T extends string>(
	prefix: string,
	ids: readonly T[],
): Record<string, string> {
	const result: Record<string, string> = {};
	for (const id of ids) {
		const key = toCamelCase(id);
		result[key] = getTestId(prefix, id);
	}
	return result;
}

/**
 * Pre-defined test IDs for the application
 *
 * Organized by feature/component for easy discovery and consistent usage.
 */
export const testIds = {
	// Login page
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

	// Header / Navigation
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

	// Courses page
	courses: {
		searchInput: "courses-search-input",
		table: "courses-table",
		tableRow: "courses-table-row",
		scatterPlot: "courses-scatter-plot",
		scatterPlotFullscreenButton: "courses-scatter-plot-fullscreen-button",
		emptyState: "courses-empty-state",
		errorState: "courses-error-state",
		retryButton: "courses-retry-button",
	},

	// Course filters
	filters: {
		panel: "filters-panel",
		drawer: "filters-drawer",
		drawerTrigger: "filters-drawer-trigger",
		drawerCloseButton: "filters-drawer-close-button",
		resetButton: "filters-reset-button",
		difficultySlider: "filters-difficulty-slider",
		usefulnessSlider: "filters-usefulness-slider",
		facultySelect: "filters-faculty-select",
		departmentSelect: "filters-department-select",
	},

	// Course details page
	courseDetails: {
		title: "course-details-title",
		rateButton: "course-details-rate-button",
		statsCards: "course-details-stats-cards",
		reviewsSection: "course-details-reviews-section",
		reviewCard: "course-details-review-card",
		noReviewsMessage: "course-details-no-reviews-message",
	},

	// Rating modal and form
	rating: {
		modal: "rating-modal",
		form: "rating-form",
		difficultySlider: "rating-difficulty-slider",
		usefulnessSlider: "rating-usefulness-slider",
		commentTextarea: "rating-comment-textarea",
		anonymousCheckbox: "rating-anonymous-checkbox",
		submitButton: "rating-submit-button",
		cancelButton: "rating-cancel-button",
		deleteButton: "rating-delete-button",
	},

	// Delete confirmation dialog
	deleteDialog: {
		root: "delete-dialog",
		confirmButton: "delete-dialog-confirm-button",
		cancelButton: "delete-dialog-cancel-button",
	},

	// My ratings page
	myRatings: {
		header: "my-ratings-header",
		list: "my-ratings-list",
		card: "my-ratings-card",
		editButton: "my-ratings-edit-button",
		deleteButton: "my-ratings-delete-button",
		emptyState: "my-ratings-empty-state",
		errorState: "my-ratings-error-state",
	},

	// Common / Shared
	common: {
		loadingSpinner: "loading-spinner",
		infiniteScrollLoader: "infinite-scroll-loader",
		pagination: "pagination",
		paginationPrevious: "pagination-previous-button",
		paginationNext: "pagination-next-button",
	},
} as const;

/**
 * Type helper to get test ID keys for a specific feature
 */
export type TestIdKeys<T extends keyof typeof testIds> =
	keyof (typeof testIds)[T];

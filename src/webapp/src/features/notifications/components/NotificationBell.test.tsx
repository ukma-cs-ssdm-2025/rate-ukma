import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { testIds } from "@/lib/test-ids";
import { renderWithProviders } from "@/test-utils/render";
import { NotificationBell } from "./NotificationBell";

const mockMarkAllRead = vi.fn();
const mockMarkGroupRead = vi.fn();
const mockResetPagination = vi.fn();
const mockRefetch = vi.fn();
const mockLoadMore = vi.fn();

const mockUseUnreadCount = vi.fn();
const mockUseNotifications = vi.fn();

vi.mock("../hooks/useNotifications", () => ({
	useUnreadCount: (...args: unknown[]) => mockUseUnreadCount(...args),
	useNotifications: (...args: unknown[]) => mockUseNotifications(...args),
	useMarkAllRead: () => ({
		markAllRead: mockMarkAllRead,
		isPending: false,
	}),
	useMarkGroupRead: () => ({
		markGroupRead: mockMarkGroupRead,
	}),
}));

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return {
		...actual,
		Link: ({
			children,
			className,
			onClick,
		}: {
			to: string;
			params?: Record<string, string>;
			children: React.ReactNode;
			className?: string;
			onClick?: () => void;
		}) => (
			<button type="button" className={className} onClick={onClick}>
				{children}
			</button>
		),
	};
});

function setupDefaultMocks({
	unreadCount = 0,
	notifications = [],
	isLoading = false,
	isError = false,
	hasMore = false,
}: {
	unreadCount?: number;
	notifications?: Array<{
		group_key: string;
		event_type: string;
		message: string;
		is_unread: boolean;
		course_id?: string | null;
		latest_created_at?: string;
		count?: number;
	}>;
	isLoading?: boolean;
	isError?: boolean;
	hasMore?: boolean;
} = {}) {
	mockUseUnreadCount.mockReturnValue({ data: { count: unreadCount } });
	mockUseNotifications.mockReturnValue({
		notifications,
		isLoading,
		isError,
		refetch: mockRefetch,
		isRefetching: false,
		loadMore: mockLoadMore,
		isLoadingMore: false,
		hasMore,
		resetPagination: mockResetPagination,
	});
}

describe("NotificationBell", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupDefaultMocks();
	});

	it("should render bell button", () => {
		renderWithProviders(<NotificationBell />);

		expect(
			screen.getByTestId(testIds.notifications.bellTrigger),
		).toBeInTheDocument();
	});

	it("should not show badge when unread count is 0", () => {
		setupDefaultMocks({ unreadCount: 0 });
		renderWithProviders(<NotificationBell />);

		const button = screen.getByTestId(testIds.notifications.bellTrigger);
		expect(button.querySelector("span")).not.toBeInTheDocument();
	});

	it("should show badge with unread count", () => {
		setupDefaultMocks({ unreadCount: 5 });
		renderWithProviders(<NotificationBell />);

		expect(screen.getByText("5")).toBeInTheDocument();
	});

	it("should show 99+ for large unread counts", () => {
		setupDefaultMocks({ unreadCount: 150 });
		renderWithProviders(<NotificationBell />);

		expect(screen.getByText("99+")).toBeInTheDocument();
	});

	it("should include unread count in aria-label", () => {
		setupDefaultMocks({ unreadCount: 3 });
		renderWithProviders(<NotificationBell />);

		expect(
			screen.getByLabelText("Сповіщення (3 непрочитаних)"),
		).toBeInTheDocument();
	});

	it("should open popover and show notifications on click", async () => {
		const user = userEvent.setup();
		setupDefaultMocks({
			notifications: [
				{
					group_key: "key-1",
					event_type: "RATING_UPVOTED",
					message: "Тестове сповіщення",
					is_unread: true,
					course_id: "c-1",
					latest_created_at: new Date().toISOString(),
					count: 1,
				},
			],
		});

		renderWithProviders(<NotificationBell />);

		await user.click(screen.getByTestId(testIds.notifications.bellTrigger));

		await waitFor(() => {
			expect(
				screen.getByTestId(testIds.notifications.panel),
			).toBeInTheDocument();
		});
		expect(screen.getByText("Тестове сповіщення")).toBeInTheDocument();
		expect(screen.getByText("Сповіщення")).toBeInTheDocument();
	});

	it("should show mark-all-read button when there are unread notifications", async () => {
		const user = userEvent.setup();
		setupDefaultMocks({ unreadCount: 2 });

		renderWithProviders(<NotificationBell />);

		await user.click(screen.getByTestId(testIds.notifications.bellTrigger));

		await waitFor(() => {
			expect(
				screen.getByTestId(testIds.notifications.markReadButton),
			).toBeInTheDocument();
		});
	});

	it("should not show mark-all-read button when no unread notifications", async () => {
		const user = userEvent.setup();
		setupDefaultMocks({ unreadCount: 0 });

		renderWithProviders(<NotificationBell />);

		await user.click(screen.getByTestId(testIds.notifications.bellTrigger));

		await waitFor(() => {
			expect(
				screen.getByTestId(testIds.notifications.panel),
			).toBeInTheDocument();
		});
		expect(
			screen.queryByTestId(testIds.notifications.markReadButton),
		).not.toBeInTheDocument();
	});

	it("should call markAllRead and resetPagination when mark-all-read is clicked", async () => {
		const user = userEvent.setup();
		setupDefaultMocks({ unreadCount: 3 });

		renderWithProviders(<NotificationBell />);

		await user.click(screen.getByTestId(testIds.notifications.bellTrigger));

		await waitFor(() => {
			expect(
				screen.getByTestId(testIds.notifications.markReadButton),
			).toBeInTheDocument();
		});

		await user.click(screen.getByTestId(testIds.notifications.markReadButton));
		expect(mockMarkAllRead).toHaveBeenCalledTimes(1);
		expect(mockResetPagination).toHaveBeenCalledTimes(1);
	});

	it("should show empty state when no notifications exist", async () => {
		const user = userEvent.setup();
		setupDefaultMocks({ notifications: [] });

		renderWithProviders(<NotificationBell />);

		await user.click(screen.getByTestId(testIds.notifications.bellTrigger));

		await waitFor(() => {
			expect(
				screen.getByTestId(testIds.notifications.empty),
			).toBeInTheDocument();
		});
	});

	it("should show error state when fetch fails", async () => {
		const user = userEvent.setup();
		setupDefaultMocks({ isError: true });

		renderWithProviders(<NotificationBell />);

		await user.click(screen.getByTestId(testIds.notifications.bellTrigger));

		await waitFor(() => {
			expect(
				screen.getByTestId(testIds.notifications.error),
			).toBeInTheDocument();
		});
	});
});

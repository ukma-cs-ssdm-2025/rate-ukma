import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NotificationGroup } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { Providers } from "@/test-utils/render";
import { renderWithRouter } from "@/test-utils/router";
import { NotificationBell } from "./NotificationBell";
import * as notificationsHooks from "../hooks/useNotifications";

const mockMarkAllRead = vi.fn();
const mockMarkGroupRead = vi.fn();
const mockResetPagination = vi.fn();
const mockRefetch = vi.fn();
const mockLoadMore = vi.fn();

interface NotificationsStub {
	notifications: NotificationGroup[];
	isLoading: boolean;
	isError: boolean;
	refetch: ReturnType<typeof vi.fn>;
	isRefetching: boolean;
	loadMore: ReturnType<typeof vi.fn>;
	isLoadingMore: boolean;
	hasMore: boolean;
	resetPagination: ReturnType<typeof vi.fn>;
}

interface UnreadCountStub {
	data: { count: number } | undefined;
	isSuccess: boolean;
	isError: boolean;
}

function unreadCountStub(count: number): UnreadCountStub {
	return { data: { count }, isSuccess: true, isError: false };
}

function setupDefaultMocks({
	unreadCount = 0,
	notifications = [],
	isLoading = false,
	isError = false,
	hasMore = false,
}: {
	unreadCount?: number;
	notifications?: NotificationGroup[];
	isLoading?: boolean;
	isError?: boolean;
	hasMore?: boolean;
} = {}) {
	vi.spyOn(notificationsHooks, "useUnreadCount").mockReturnValue(
		// SAFETY: NotificationBell only reads data.count from this query.
		unreadCountStub(unreadCount) as ReturnType<
			typeof notificationsHooks.useUnreadCount
		>,
	);
	const notificationsStub: NotificationsStub = {
		notifications,
		isLoading,
		isError,
		refetch: mockRefetch,
		isRefetching: false,
		loadMore: mockLoadMore,
		isLoadingMore: false,
		hasMore,
		resetPagination: mockResetPagination,
	};
	vi.spyOn(notificationsHooks, "useNotifications").mockReturnValue(
		// SAFETY: NotificationBell reads exactly the fields NotificationsStub provides.
		notificationsStub as ReturnType<typeof notificationsHooks.useNotifications>,
	);
	vi.spyOn(notificationsHooks, "useMarkAllRead").mockReturnValue({
		markAllRead: mockMarkAllRead,
		isPending: false,
	});
	vi.spyOn(notificationsHooks, "useMarkGroupRead").mockReturnValue({
		markGroupRead: mockMarkGroupRead,
	});
}

describe("NotificationBell", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupDefaultMocks();
	});

	it("should render bell button", async () => {
		await renderWithRouter(
			<Providers>
				<NotificationBell />
			</Providers>,
		);

		expect(
			screen.getByTestId(testIds.notifications.bellTrigger),
		).toBeInTheDocument();
	});

	it("should not show badge when unread count is 0", async () => {
		setupDefaultMocks({ unreadCount: 0 });
		await renderWithRouter(
			<Providers>
				<NotificationBell />
			</Providers>,
		);

		const button = screen.getByTestId(testIds.notifications.bellTrigger);
		expect(button.querySelector("span")).not.toBeInTheDocument();
	});

	it("should show badge with unread count", async () => {
		setupDefaultMocks({ unreadCount: 5 });
		await renderWithRouter(
			<Providers>
				<NotificationBell />
			</Providers>,
		);

		expect(screen.getByText("5")).toBeInTheDocument();
	});

	it("should show 99+ for large unread counts", async () => {
		setupDefaultMocks({ unreadCount: 150 });
		await renderWithRouter(
			<Providers>
				<NotificationBell />
			</Providers>,
		);

		expect(screen.getByText("99+")).toBeInTheDocument();
	});

	it("should include unread count in aria-label", async () => {
		setupDefaultMocks({ unreadCount: 3 });
		await renderWithRouter(
			<Providers>
				<NotificationBell />
			</Providers>,
		);

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
					latest_notification_id: "notification-1",
					source_object_id: "rating-1",
					message: "Тестове сповіщення",
					is_unread: true,
					course_id: "c-1",
					rating_id: "rating-1",
					latest_created_at: new Date().toISOString(),
					count: 1,
				},
			],
		});

		await renderWithRouter(
			<Providers>
				<NotificationBell />
			</Providers>,
		);

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

		await renderWithRouter(
			<Providers>
				<NotificationBell />
			</Providers>,
		);

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

		await renderWithRouter(
			<Providers>
				<NotificationBell />
			</Providers>,
		);

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

		await renderWithRouter(
			<Providers>
				<NotificationBell />
			</Providers>,
		);

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

		await renderWithRouter(
			<Providers>
				<NotificationBell />
			</Providers>,
		);

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

		await renderWithRouter(
			<Providers>
				<NotificationBell />
			</Providers>,
		);

		await user.click(screen.getByTestId(testIds.notifications.bellTrigger));

		await waitFor(() => {
			expect(
				screen.getByTestId(testIds.notifications.error),
			).toBeInTheDocument();
		});
	});
});

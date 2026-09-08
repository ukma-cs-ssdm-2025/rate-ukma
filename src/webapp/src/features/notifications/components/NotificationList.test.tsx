import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { NotificationGroup } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { Providers } from "@/test-utils/render";
import { renderWithRouter } from "@/test-utils/router";
import { NotificationList } from "./NotificationList";

function createNotification(
	overrides?: Partial<NotificationGroup>,
): NotificationGroup {
	return {
		group_key: "RATING_UPVOTED:rating-1",
		event_type: "RATING_UPVOTED",
		latest_notification_id: "notif-1",
		source_object_id: "vote-1",
		count: 1,
		latest_created_at: new Date().toISOString(),
		is_unread: true,
		message: "Іван оцінив ваш відгук",
		rating_id: "rating-1",
		course_id: "course-1",
		...overrides,
	};
}

describe("NotificationList", () => {
	it("should show loading state", async () => {
		await renderWithRouter(
			<Providers>
				<NotificationList notifications={[]} isLoading={true} />
			</Providers>,
		);

		expect(
			screen.getByTestId(testIds.notifications.loading),
		).toBeInTheDocument();
		expect(screen.getByText("Завантаження...")).toBeInTheDocument();
	});

	it("should show empty state when no notifications", async () => {
		await renderWithRouter(
			<Providers>
				<NotificationList notifications={[]} isLoading={false} />
			</Providers>,
		);

		expect(screen.getByTestId(testIds.notifications.empty)).toBeInTheDocument();
		expect(screen.getByText("Немає сповіщень")).toBeInTheDocument();
	});

	it("should show error state with retry button", async () => {
		const user = userEvent.setup();
		const onRetry = vi.fn();

		await renderWithRouter(
			<Providers>
				<NotificationList
					notifications={[]}
					isLoading={false}
					isError={true}
					onRetry={onRetry}
				/>
			</Providers>,
		);

		expect(screen.getByTestId(testIds.notifications.error)).toBeInTheDocument();
		expect(screen.getByText("Не вдалося завантажити")).toBeInTheDocument();

		await user.click(screen.getByText("Спробувати знову"));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("should render notification items", async () => {
		const notifications = [
			createNotification({ group_key: "key-1", message: "Перше сповіщення" }),
			createNotification({
				group_key: "key-2",
				message: "Друге сповіщення",
				event_type: "RATING_DOWNVOTED",
				is_unread: false,
			}),
		];

		await renderWithRouter(
			<Providers>
				<NotificationList notifications={notifications} isLoading={false} />
			</Providers>,
		);

		expect(screen.getByTestId(testIds.notifications.list)).toBeInTheDocument();
		expect(screen.getAllByTestId(testIds.notifications.item)).toHaveLength(2);
		expect(screen.getByText("Перше сповіщення")).toBeInTheDocument();
		expect(screen.getByText("Друге сповіщення")).toBeInTheDocument();
	});

	it("should call onNotificationClick when a linked item is clicked", async () => {
		const user = userEvent.setup();
		const onClick = vi.fn();
		const notifications = [
			createNotification({ group_key: "click-key", course_id: "c-1" }),
		];

		await renderWithRouter(
			<Providers>
				<NotificationList
					notifications={notifications}
					isLoading={false}
					onNotificationClick={onClick}
				/>
			</Providers>,
		);

		const link = screen.getByRole("link");
		await user.click(link);
		expect(onClick).toHaveBeenCalledWith("click-key");
	});

	it("should not render as link when course_id is missing", async () => {
		const notifications = [
			createNotification({ group_key: "no-link", course_id: null }),
		];

		await renderWithRouter(
			<Providers>
				<NotificationList notifications={notifications} isLoading={false} />
			</Providers>,
		);

		expect(screen.queryByRole("link")).not.toBeInTheDocument();
	});

	it("should show load more button when hasMore is true", async () => {
		const user = userEvent.setup();
		const onLoadMore = vi.fn();
		const notifications = [createNotification()];

		await renderWithRouter(
			<Providers>
				<NotificationList
					notifications={notifications}
					isLoading={false}
					hasMore={true}
					onLoadMore={onLoadMore}
				/>
			</Providers>,
		);

		const loadMoreButton = screen.getByTestId(testIds.notifications.loadMore);
		expect(loadMoreButton).toBeInTheDocument();
		expect(loadMoreButton).toHaveTextContent("Завантажити ще");

		await user.click(loadMoreButton);
		expect(onLoadMore).toHaveBeenCalledTimes(1);
	});

	it("should disable load more button while loading more", async () => {
		const notifications = [createNotification()];

		await renderWithRouter(
			<Providers>
				<NotificationList
					notifications={notifications}
					isLoading={false}
					hasMore={true}
					isLoadingMore={true}
					onLoadMore={vi.fn()}
				/>
			</Providers>,
		);

		expect(screen.getByTestId(testIds.notifications.loadMore)).toBeDisabled();
	});

	it("should not show load more button when hasMore is false", async () => {
		const notifications = [createNotification()];

		await renderWithRouter(
			<Providers>
				<NotificationList
					notifications={notifications}
					isLoading={false}
					hasMore={false}
				/>
			</Providers>,
		);

		expect(
			screen.queryByTestId(testIds.notifications.loadMore),
		).not.toBeInTheDocument();
	});

	it("should show unread indicator for unread notifications", async () => {
		const notifications = [
			createNotification({ group_key: "unread", is_unread: true }),
		];

		await renderWithRouter(
			<Providers>
				<NotificationList notifications={notifications} isLoading={false} />
			</Providers>,
		);

		const item = screen.getByTestId(testIds.notifications.item);
		const dot = item.querySelector(".rounded-full.bg-primary");
		expect(dot).toBeInTheDocument();
	});

	it("should not show unread indicator for read notifications", async () => {
		const notifications = [
			createNotification({ group_key: "read", is_unread: false }),
		];

		await renderWithRouter(
			<Providers>
				<NotificationList notifications={notifications} isLoading={false} />
			</Providers>,
		);

		const item = screen.getByTestId(testIds.notifications.item);
		const dot = item.querySelector(".rounded-full.bg-primary");
		expect(dot).not.toBeInTheDocument();
	});
});

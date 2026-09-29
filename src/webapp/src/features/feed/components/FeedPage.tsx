import type { ReactNode } from "react";

import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { FeedEmptyState } from "./FeedEmptyState";
import { FeedErrorState } from "./FeedErrorState";
import { FeedItem } from "./FeedItem";
import { FeedSkeleton } from "./FeedCard";
import type { UseFeedReturn } from "../hooks/useFeed";
import { useFeed } from "../hooks/useFeed";
import { useFeatureFlagState } from "@/lib/feature-flags";
import { testIds } from "@/lib/test-ids";

export function FeedPage() {
	const { enabled, isReady } = useFeatureFlagState("fe_feed");
	const feed = useFeed({ enabled: isReady && enabled });

	return (
		<Layout>
			<div className="mx-auto max-w-2xl space-y-6">
				<PageHeader
					title="Стрічка оновлень"
					description="Останні відгуки та оголошення Могилянки"
				/>

				{resolveContent({ isReady, enabled, feed })}
			</div>
		</Layout>
	);
}

function resolveContent({
	isReady,
	enabled,
	feed,
}: {
	isReady: boolean;
	enabled: boolean;
	feed: UseFeedReturn;
}): ReactNode {
	// Stay blank until the flag resolves, so a disabled feed never flashes in.
	if (!isReady) return null;
	if (!enabled) {
		return (
			<p
				className="text-muted-foreground"
				data-testid={testIds.feed.unavailableState}
			>
				Стрічка наразі недоступна.
			</p>
		);
	}
	if (feed.isLoading) return <FeedSkeleton />;
	if (feed.isError) {
		return (
			<FeedErrorState onRetry={feed.refetch} isRetrying={feed.isRefetching} />
		);
	}
	if (feed.items.length === 0) return <FeedEmptyState />;

	return (
		<>
			<div className="space-y-3" data-testid={testIds.feed.list}>
				{feed.items.map((item) => (
					<FeedItem
						key={`${item.kind}:${item.id}`}
						item={item}
						variant="banner"
					/>
				))}
			</div>

			{/* Sentinel: intersecting it pulls the next page. */}
			<div ref={feed.loaderRef} className="h-px" aria-hidden />
			{feed.isFetchingNextPage && (
				<p className="text-center text-sm text-muted-foreground">
					Завантаження…
				</p>
			)}
			{!feed.hasMore && (
				<p className="text-center text-sm text-muted-foreground">
					Це вся стрічка
				</p>
			)}
		</>
	);
}

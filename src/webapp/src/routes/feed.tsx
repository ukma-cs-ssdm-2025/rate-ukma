import type { ReactNode } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Newspaper, Pin } from "lucide-react";

import Layout from "@/components/Layout";
import { FeedEmptyState } from "@/features/feed/components/FeedEmptyState";
import { FeedErrorState } from "@/features/feed/components/FeedErrorState";
import { FeedPromoItem } from "@/features/feed/components/FeedPromoItem";
import { FeedReviewItem } from "@/features/feed/components/FeedReviewItem";
import { FeedSkeleton } from "@/features/feed/components/FeedSkeleton";
import { isPromoItem } from "@/features/feed/feedTypes";
import type { UseFeedReturn } from "@/features/feed/hooks/useFeed";
import { useFeed } from "@/features/feed/hooks/useFeed";
import { withAuth } from "@/lib/auth/withAuth";
import { useFeatureFlagState } from "@/lib/feature-flags/useFeatureFlag";
import { testIds } from "@/lib/test-ids";

export function FeedRoute() {
	const { enabled, isReady } = useFeatureFlagState("fe_feed");
	const feed = useFeed({ enabled: isReady && enabled });

	return (
		<Layout>
			<div className="mx-auto max-w-2xl space-y-6">
				<header className="space-y-1">
					<h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
						<Newspaper className="size-6 text-muted-foreground" />
						Стрічка оновлень
					</h1>
					<p className="text-muted-foreground">
						Останні відгуки та оголошення Могилянки
					</p>
				</header>

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
					<div key={`${item.kind}:${item.id}`} className="relative">
						{item.pinned && (
							<span className="absolute right-3 top-3 z-10 inline-flex items-center rounded-full border bg-background/90 p-1 text-muted-foreground shadow-sm backdrop-blur">
								<Pin className="size-3" />
							</span>
						)}
						{isPromoItem(item) ? (
							<FeedPromoItem item={item} variant="banner" />
						) : (
							<div className="rounded-xl border bg-card px-4 shadow-sm">
								<FeedReviewItem item={item} />
							</div>
						)}
					</div>
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

export const Route = createFileRoute("/feed")({
	component: withAuth(FeedRoute),
});

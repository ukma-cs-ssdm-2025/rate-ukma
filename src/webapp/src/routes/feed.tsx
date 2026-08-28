import { createFileRoute } from "@tanstack/react-router";
import { Newspaper, Pin } from "lucide-react";

import Layout from "@/components/Layout";
import { FeedPromoItem } from "@/features/feed/components/FeedPromoItem";
import { FeedReviewItem } from "@/features/feed/components/FeedReviewItem";
import { FEED_FLAG } from "@/features/feed/feedFlags";
import { MOCK_FEED_ITEMS } from "@/features/feed/feedMockData";
import { isPromoItem, orderFeedItems } from "@/features/feed/feedTypes";
import { withAuth } from "@/lib/auth";
import { useFeatureFlagState } from "@/lib/feature-flags";

export function FeedRoute() {
	const { enabled, isReady } = useFeatureFlagState(FEED_FLAG);
	const items = orderFeedItems(MOCK_FEED_ITEMS);

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

				{!isReady ? null : !enabled ? (
					<p className="text-muted-foreground">Стрічка наразі недоступна.</p>
				) : (
					<div className="space-y-3">
						{items.map((item) => (
							<div key={item.id} className="relative">
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
				)}
			</div>
		</Layout>
	);
}

export const Route = createFileRoute("/feed")({
	component: withAuth(FeedRoute),
});

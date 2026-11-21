import type { FeedItem as FeedItemData } from "@/lib/api/generated";
import { FeedCommentItem } from "./FeedCommentItem";
import { FeedPromoItem } from "./FeedPromoItem";
import { FeedReviewItem } from "./FeedReviewItem";

interface FeedItemProps {
	readonly item: FeedItemData;
	readonly variant?: "card" | "banner";
}

export function FeedItem({ item, variant = "card" }: Readonly<FeedItemProps>) {
	switch (item.kind) {
		case "promo":
			return <FeedPromoItem item={item} variant={variant} />;
		case "comment":
			return <FeedCommentItem item={item} variant={variant} />;
		case "review":
			return <FeedReviewItem item={item} variant={variant} />;
	}
}

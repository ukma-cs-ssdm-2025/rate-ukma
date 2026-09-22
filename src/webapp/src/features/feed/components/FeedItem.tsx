import type { FeedItem as FeedItemType } from "../feedTypes";
import { isCommentItem, isPromoItem } from "../feedTypes";
import { FeedCommentItem } from "./FeedCommentItem";
import { FeedPromoItem } from "./FeedPromoItem";
import { FeedReviewItem } from "./FeedReviewItem";

interface FeedItemProps {
	readonly item: FeedItemType;
	readonly variant?: "card" | "banner";
}

export function FeedItem({ item, variant = "card" }: Readonly<FeedItemProps>) {
	if (isPromoItem(item)) return <FeedPromoItem item={item} variant={variant} />;
	if (isCommentItem(item)) return <FeedCommentItem item={item} />;
	return <FeedReviewItem item={item} />;
}

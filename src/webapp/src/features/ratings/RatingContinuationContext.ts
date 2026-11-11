import { createContext } from "react";

import type { RatingSuggestion } from "./hooks/useRatingSuggestions";

export interface SavedRating {
	readonly courseId: string;
	readonly isAnonymous: boolean;
}

export interface FollowUpRating extends RatingSuggestion {
	readonly isAnonymous: boolean;
	readonly status: "requested" | "active";
}

export const RatingContinuationContext = createContext<{
	complete: (rating: SavedRating, offerNext: boolean) => void;
	followUp: FollowUpRating | null;
	beginFollowUp: () => void;
	cancelFollowUp: () => void;
} | null>(null);

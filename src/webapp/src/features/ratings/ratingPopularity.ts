const Z = 1.96;

// Mirrors WilsonPopularityAnnotator in the backend, so a vote reorders the
// loaded reviews exactly as the next fetch would.
export function popularityScore(upvotes: number, downvotes: number): number {
	const n = upvotes + downvotes;
	if (n === 0) return 0;
	if (upvotes === 0) return -downvotes;
	const p = upvotes / n;
	const z2 = Z * Z;
	const spread = Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
	return (p + z2 / (2 * n) - Z * spread) / (1 + z2 / n);
}

export interface VoteCounts {
	readonly upvotes: number;
	readonly downvotes: number;
}

// Stable: equal scores keep the server order, so untouched reviews stay put.
export function orderByPopularity<
	T extends { id?: string; upvotes?: number; downvotes?: number },
>(ratings: readonly T[], overrides: Readonly<Record<string, VoteCounts>>): T[] {
	const score = (rating: T) => {
		const counts = (rating.id && overrides[rating.id]) || {
			upvotes: rating.upvotes ?? 0,
			downvotes: rating.downvotes ?? 0,
		};
		return popularityScore(counts.upvotes, counts.downvotes);
	};
	return ratings
		.map((rating, index) => ({ rating, index, score: score(rating) }))
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.map(({ rating }) => rating);
}

import { Link } from "@tanstack/react-router";
import { ArrowRight, Star } from "lucide-react";

import { FeedCard } from "@/features/feed/components/FeedCard";
import { FEED_TILE_CLASS } from "@/features/feed/components/FeedStrip";
import { useRateableCount } from "./useRateableCount";

function waitingText(count: number, more = false, short = false): string {
	const mod10 = count % 10;
	const mod100 = count % 100;
	let noun = "курсів чекають";
	if (mod10 === 1 && mod100 !== 11) noun = "курс чекає";
	else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
		noun = "курси чекають";
	return `${more ? "Ще " : ""}${count} ${noun} на ${short ? "" : "вашу "}оцінку`;
}

/**
 * Home: the first tile of the feed strip, in the feed's own card, so the
 * prompt costs no extra row on the page.
 */
export function RateFeedTile() {
	const count = useRateableCount();
	if (count === 0) return null;

	return (
		<div className={FEED_TILE_CLASS}>
			<FeedCard
				tinted
				kind={{ label: "Ваші курси", icon: Star, tone: "primary" }}
				title={
					<Link
						to="/rate"
						className="underline-offset-4 transition-colors hover:text-primary hover:underline"
					>
						{waitingText(count, false, true)}
					</Link>
				}
				footer={
					<Link
						to="/rate"
						tabIndex={-1}
						className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
					>
						Оцінити по черзі
						<ArrowRight className="size-3.5" aria-hidden="true" />
					</Link>
				}
			>
				Допоможіть іншим обрати курси
			</FeedCard>
		</div>
	);
}

/**
 * Course page: one line under the student's own rating block, never on a
 * course they did not take. The course on screen has its own button, so it
 * is left out of the count.
 */
export function RateNextLine({
	excludeOfferingId,
}: Readonly<{ excludeOfferingId?: string }>) {
	const count = useRateableCount(excludeOfferingId);
	if (count === 0) return null;

	return (
		<p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-sm text-muted-foreground">
			<span>{waitingText(count, true)}</span>
			<Link
				to="/rate"
				className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
			>
				Оцінити по черзі
				<ArrowRight className="size-4" aria-hidden="true" />
			</Link>
		</p>
	);
}

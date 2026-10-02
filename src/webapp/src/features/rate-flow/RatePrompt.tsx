import { Link } from "@tanstack/react-router";
import { ArrowRight, Star } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { FeedCard } from "@/features/feed/components/FeedCard";
import { FEED_TILE_CLASS } from "@/features/feed/components/FeedStrip";
import { useRateableCount } from "./useRateableCount";
import { coursesNoun, pluralUk } from "./plural";

function waitingText(count: number, more = false, short = false): string {
	const noun = pluralUk(count, [
		"курс чекає",
		"курси чекають",
		"курсів чекають",
	]);
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
					// The strip's promo tiles end on the right with their action.
					<div className="flex justify-end text-xs">
						<Link
							to="/rate"
							tabIndex={-1}
							className="inline-flex min-w-0 items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
						>
							<span className="truncate">Оцінити курси</span>
							<ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
						</Link>
					</div>
				}
			>
				Допоможіть іншим обрати курси
			</FeedCard>
		</div>
	);
}

/**
 * Course page: a one-line card under «Про курс». The course on
 * screen has its own «Оцінити курс» block, so it is left out of the count.
 */
export function RateSideCard({
	leaveOutCurrent = false,
	more = false,
}: Readonly<{
	/** This course is open and unrated, with its own button on the page. */
	leaveOutCurrent?: boolean;
	/** The student rated or can rate this course: «Ще N». */
	more?: boolean;
}>) {
	const count = useRateableCount(leaveOutCurrent);
	if (count === 0) return null;

	return (
		<aside
			aria-label="Курси без оцінки"
			className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-4 py-3"
		>
			<p className="min-w-0 text-sm font-medium">
				{`${more ? "Ще " : ""}${count} ${coursesNoun(count)} без оцінки`}
			</p>
			<Button size="sm" variant="outline" asChild className="shrink-0">
				<Link to="/rate">Оцінити</Link>
			</Button>
		</aside>
	);
}

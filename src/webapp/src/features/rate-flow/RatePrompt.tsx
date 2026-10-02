import { Link } from "@tanstack/react-router";
import { ArrowRight, Star } from "lucide-react";

import { Button } from "@/components/ui/Button";
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
 * Course page: a small card at the top of the right column. The course on
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
			className="space-y-3 rounded-xl bg-muted/50 p-4"
		>
			<div className="space-y-0.5">
				<p className="font-medium">{waitingText(count, more)}</p>
				<p className="text-sm text-muted-foreground">
					По одному курсу на екрані, без пошуку
				</p>
			</div>
			<Button size="sm" variant="outline" asChild>
				<Link to="/rate">
					Оцінити курси
					<ArrowRight aria-hidden="true" />
				</Link>
			</Button>
		</aside>
	);
}

import { useState } from "react";

import { Link } from "@tanstack/react-router";
import { ArrowRight, Star, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { localStorageAdapter } from "@/lib/storage";
import { useRateableCount } from "./useRateableCount";

const SNOOZE_KEY = "rate-ukma-rate-prompt-snoozed";
const SNOOZE_DAYS = 7;

interface Snooze {
	until: number;
	count: number;
}

function waitingText(count: number, more = false): string {
	const mod10 = count % 10;
	const mod100 = count % 100;
	let noun = "курсів чекають";
	if (mod10 === 1 && mod100 !== 11) noun = "курс чекає";
	else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
		noun = "курси чекають";
	return `${more ? "Ще " : ""}${count} ${noun} на вашу оцінку`;
}

// Closing the bar hides it for a week, or until another course becomes
// rateable: the end of a semester is exactly when it should come back.
function useSnooze(count: number) {
	const [snooze, setSnooze] = useState<Snooze | null>(() =>
		localStorageAdapter.getItem<Snooze>(SNOOZE_KEY),
	);
	const snoozed =
		snooze != null && Date.now() < snooze.until && count <= snooze.count;
	const dismiss = () => {
		const next = {
			until: Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000,
			count,
		};
		localStorageAdapter.setItem(SNOOZE_KEY, next);
		setSnooze(next);
	};
	return { snoozed, dismiss };
}

/** Home page: a slim bar in the promo banner's shape, closable for a week. */
export function RatePromptBar() {
	const count = useRateableCount();
	const { snoozed, dismiss } = useSnooze(count);
	if (count === 0 || snoozed) return null;

	return (
		<aside
			aria-label="Курси без оцінки"
			className="flex items-center gap-3 rounded-lg border bg-card-user px-4 py-3 shadow-sm"
		>
			<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
				<Star className="size-4 fill-current" aria-hidden="true" />
			</span>
			<p className="min-w-0 flex-1 text-sm">
				<span className="font-medium">{waitingText(count)}</span>
				<span className="ml-2 hidden text-muted-foreground sm:inline">
					Вони допоможуть іншим обрати курси
				</span>
			</p>
			<Link
				to="/rate"
				className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
			>
				Оцінити
				<ArrowRight className="size-4" aria-hidden="true" />
			</Link>
			<Button
				variant="ghost"
				size="icon-sm"
				className="size-10 shrink-0"
				onClick={dismiss}
				aria-label="Сховати на тиждень"
			>
				<X className="size-4" />
			</Button>
		</aside>
	);
}

/**
 * Course page: the student's other unrated courses, beside «Про курс». The
 * course on screen has its own «Оцінити курс» block, so it is left out.
 */
export function RatePromptCard({
	excludeOfferingId,
}: Readonly<{ excludeOfferingId?: string }>) {
	const count = useRateableCount(excludeOfferingId);
	if (count === 0) return null;

	return (
		<aside
			aria-label="Курси без оцінки"
			className="space-y-3 rounded-xl bg-muted/50 p-4"
		>
			<div className="space-y-0.5">
				<p className="font-medium">
					{waitingText(count, Boolean(excludeOfferingId))}
				</p>
				<p className="text-sm text-muted-foreground">
					По одному екрану на курс, без пошуку
				</p>
			</div>
			<Button size="sm" variant="outline" asChild>
				<Link to="/rate">
					Оцінити по черзі
					<ArrowRight aria-hidden="true" />
				</Link>
			</Button>
		</aside>
	);
}

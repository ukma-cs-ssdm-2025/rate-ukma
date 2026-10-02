import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { useRateableCount } from "./useRateableCount";

const PULSED_KEY = "rate-ukma-rate-badge-pulsed";

// The header remounts on every page, so the pulse is spent once per session:
// enough to be noticed, not a light that never stops blinking. It is claimed
// only once there is a count to show, and a header that remounts within the
// pulse's own run (a route settling) keeps it going instead of cutting it.
const PULSE_MS = 3000;

function claimPulse(): boolean {
	try {
		const startedAt = Number(globalThis.sessionStorage.getItem(PULSED_KEY));
		if (startedAt) return Date.now() - startedAt < PULSE_MS;
		globalThis.sessionStorage.setItem(PULSED_KEY, String(Date.now()));
		return true;
	} catch {
		return false;
	}
}

function usePulseOnce(active: boolean): boolean {
	const [pulse, setPulse] = useState(false);
	useEffect(() => {
		if (active && claimPulse()) setPulse(true);
	}, [active]);
	return pulse;
}

function coursesWord(count: number): string {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return "курс чекає";
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
		return "курси чекають";
	return "курсів чекають";
}

/** Unrated courses next to «Мої оцінки»; renders nothing when there are none. */
export function RateCountBadge({
	className,
	pulse: canPulse = false,
}: Readonly<{
	className?: string;
	/** Only the desktop header pulses; the phone menu has its own dot. */
	pulse?: boolean;
}>) {
	const count = useRateableCount();
	const pulse = usePulseOnce(canPulse && count > 0);
	if (count === 0) return null;

	return (
		<span className={cn("relative inline-flex", className)}>
			{pulse ? (
				<span
					aria-hidden="true"
					className="absolute inset-0 animate-ping rounded-full bg-primary/50 [animation-iteration-count:3] motion-reduce:hidden"
				/>
			) : null}
			<span className="relative flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
				{count > 99 ? "99+" : count}
			</span>
			<span className="sr-only">
				{count} {coursesWord(count)} на оцінку
			</span>
		</span>
	);
}

/** A dot on the phone menu button while something waits for a rating. */
export function RateCountDot() {
	const count = useRateableCount();
	if (count === 0) return null;
	return (
		<span
			aria-hidden="true"
			className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-background"
		/>
	);
}

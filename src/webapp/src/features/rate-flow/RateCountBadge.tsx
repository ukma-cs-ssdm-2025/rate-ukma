import { useEffect, useState } from "react";

import { CountBadge } from "@/components/ui/CountBadge";
import { useRateableCount } from "./useRateableCount";
import { coursesWaiting } from "./plural";
import { useCourseTerm } from "@/lib/course-term";

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

/** Unrated courses next to «Мої оцінки»; renders nothing when there are none. */
export function RateCountBadge({
	className,
	pulse: canPulse = false,
}: Readonly<{
	className?: string;
	/** Only the desktop header pulses; the phone menu has its own badge. */
	pulse?: boolean;
}>) {
	const term = useCourseTerm();
	const count = useRateableCount();
	const pulse = usePulseOnce(canPulse && count > 0);
	if (count === 0) return null;

	return (
		<>
			<CountBadge
				count={count}
				tone="primary"
				placement="inline"
				pulse={pulse}
				aria-hidden="true"
				className={className}
			/>
			<span className="sr-only">
				{count} {coursesWaiting(count, term)} на оцінку
			</span>
		</>
	);
}

/** The same count on the phone menu button, where the bell keeps its own. */
export function RateCountMenuBadge() {
	const count = useRateableCount();
	return <CountBadge count={count} tone="primary" aria-hidden="true" />;
}

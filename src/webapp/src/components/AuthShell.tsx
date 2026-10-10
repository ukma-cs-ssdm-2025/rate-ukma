import { type ReactNode, useEffect, useRef, useState } from "react";

import { Logo } from "@/components/Logo";
import { ModeToggle } from "@/components/ModeToggle";
import { Badge } from "@/components/ui/Badge";
import {
	getDifficultyTone,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import { getFacultyColors } from "@/lib/faculty-colors";
import { cn } from "@/lib/utils";

const INFORMATICS = "Факультет інформатики";
const ECONOMICS = "Факультет економічних наук";
const LAW = "Факультет правничих наук";
const HUMANITIES = "Факультет гуманітарних наук";
const NATURAL_SCIENCES = "Факультет природничих наук";
const SOCIAL_SCIENCES = "Факультет соціальних наук і соціальних технологій";
const HEALTH = "Факультет охорони здоров`я, соціальної роботи і психології";

// Echoes the course map: each dot is a real course, placed like on the map and
// coloured by its faculty. Positions are percentages, so the scatter fits any screen
// without cropping. Ratings and review counts are made up for illustration.
// [x, y, colour, course, faculty, usefulness, difficulty, ratings count]
const DOTS = [
	[
		11,
		22,
		"bg-faculty-purple/30",
		"Архітектура обчислювальних систем",
		INFORMATICS,
		4.31,
		3.87,
		41,
	],
	[19, 64, "bg-faculty-orange/30", "Макроекономіка", ECONOMICS, 3.64, 3.12, 19],
	[
		8,
		78,
		"bg-faculty-blue/30",
		"Українська мова за професійним спрямуванням",
		HUMANITIES,
		3.52,
		2.18,
		77,
	],
	[
		26,
		12,
		"bg-faculty-green/35",
		"Загальна фізика",
		NATURAL_SCIENCES,
		3.92,
		4.08,
		13,
	],
	[15, 44, "bg-faculty-rose/25", "Криміналістика", LAW, 4.15, 2.94, 10],
	[
		5,
		52,
		"bg-faculty-yellow/35",
		"Вступ до політичної науки",
		SOCIAL_SCIENCES,
		4.42,
		2.36,
		27,
	],
	[23, 86, "bg-faculty-teal/30", "Загальна психологія", HEALTH, 3.78, 2.61, 16],
	[80, 18, "bg-faculty-rose/25", "Основи права", LAW, 3.46, 2.27, 64],
	[
		91,
		40,
		"bg-faculty-orange/30",
		"Політична економія",
		ECONOMICS,
		3.95,
		2.83,
		23,
	],
	[
		74,
		70,
		"bg-faculty-purple/25",
		"Дискретна математика",
		INFORMATICS,
		4.38,
		4.12,
		36,
	],
	[58, 90, "bg-faculty-teal/35", "Психологія впливу", HEALTH, 4.06, 1.74, 12],
	[
		85,
		58,
		"bg-faculty-green/30",
		"Анатомія та еволюція нервової системи людини",
		NATURAL_SCIENCES,
		4.24,
		4.41,
		24,
	],
	[
		70,
		34,
		"bg-faculty-yellow/35",
		"Етнополітологія",
		SOCIAL_SCIENCES,
		3.33,
		2.52,
		17,
	],
	[
		89,
		10,
		"bg-faculty-rose/30",
		"Міжнародне публічне право",
		LAW,
		4.57,
		3.68,
		20,
	],
	[78, 90, "bg-faculty-blue/25", "Англійська мова", HUMANITIES, 3.71, 2.44, 22],
	[
		38,
		94,
		"bg-faculty-purple/25",
		"Диференціальні рівняння",
		INFORMATICS,
		3.18,
		3.94,
		9,
	],
	[
		61,
		6,
		"bg-faculty-blue/25",
		"Історія української культури",
		HUMANITIES,
		3.87,
		1.92,
		14,
	],
	[
		94,
		80,
		"bg-faculty-yellow/35",
		"Військова соціологія",
		SOCIAL_SCIENCES,
		3.58,
		3.21,
		14,
	],
] as const;

// Like on the map, a dot's area grows with the number of reviews.
const DOT_REM_PER_SQRT_RATING = 0.5;

function dotSize(ratingsCount: number) {
	return Math.sqrt(ratingsCount) * DOT_REM_PER_SQRT_RATING;
}

// Dots that take turns showing their tooltip on their own, one per faculty. They sit
// in the edge zones or below the form, so a tooltip never covers it.
const SPOTLIGHTS = [0, 8, 2, 13, 5, 11, 10];

// Share of the width on each side where a tooltip has room to open towards the centre.
const EDGE_ZONE = 17;
// Below this line there is no form, so a tooltip is free to open towards the centre.
const BOTTOM_ZONE = 80;
// Faculty names longer than this get a wider tooltip, so the badge stays on one line.
const LONG_FACULTY_NAME = 50;

const SPOTLIGHT_START_MS = 1200;
const SPOTLIGHT_SHOW_MS = 3200;
// Pause with nothing shown, so one tooltip has left before the next one arrives.
const SPOTLIGHT_REST_MS = 900;
// Longer pause after the visitor stops hovering, before the carousel moves on.
const SPOTLIGHT_RESUME_MS = 2000;
const TOOLTIP_DECIMAL_PLACES = 2;

// Tooltips only fit on wide screens, and the carousel is motion the visitor did not ask for.
const SPOTLIGHT_MEDIA =
	"(min-width: 80rem) and (prefers-reduced-motion: no-preference)";

// The dot the carousel is currently on, or null before it starts, while it is paused
// on a screen that does not qualify, or when motion is reduced.
function useSpotlightDot(paused: boolean) {
	const [enabled, setEnabled] = useState(false);
	// Even steps show a dot, odd steps are the rest after it.
	const [step, setStep] = useState(-1);

	useEffect(() => {
		const media = globalThis.matchMedia?.(SPOTLIGHT_MEDIA);
		if (!media) {
			return;
		}
		const sync = () => setEnabled(media.matches);
		sync();
		media.addEventListener?.("change", sync);
		return () => media.removeEventListener?.("change", sync);
	}, []);

	// Pausing drops the dot being shown, so the carousel resumes with the next one.
	const interrupted = useRef(false);
	useEffect(() => {
		if (!paused) {
			return;
		}
		interrupted.current = true;
		setStep((current) =>
			current >= 0 && current % 2 === 0 ? current + 1 : current,
		);
	}, [paused]);

	useEffect(() => {
		if (!enabled || paused) {
			return;
		}
		let delay = SPOTLIGHT_START_MS;
		if (interrupted.current) {
			delay = SPOTLIGHT_RESUME_MS;
		} else if (step !== -1) {
			delay = step % 2 === 0 ? SPOTLIGHT_SHOW_MS : SPOTLIGHT_REST_MS;
		}
		const timer = setTimeout(() => {
			interrupted.current = false;
			setStep((current) => (current + 1) % (SPOTLIGHTS.length * 2));
		}, delay);
		return () => clearTimeout(timer);
	}, [enabled, paused, step]);

	return enabled && step >= 0 && step % 2 === 0 ? SPOTLIGHTS[step / 2] : null;
}

function CourseTooltip({
	dot,
	visible,
}: Readonly<{ dot: number; visible: boolean }>) {
	const [x, y, , name, faculty, usefulness, difficulty, ratingsCount] =
		DOTS[dot];
	const size = dotSize(ratingsCount);
	const facultyColors = getFacultyColors(faculty);
	// Like the map's tooltip: a corner of the card lands inside the dot. Edge dots open
	// towards the centre, the rest open outwards, away from the form.
	const inset = `${size * 0.3}rem`;
	const opensRight =
		y >= BOTTOM_ZONE
			? x < 50
			: x < EDGE_ZONE || (x >= 50 && x <= 100 - EDGE_ZONE);
	const opensDown = y <= 55;
	return (
		<div
			style={{
				...(opensRight
					? { left: `calc(${x}% + ${inset})` }
					: { right: `calc(${100 - x}% + ${inset})` }),
				...(opensDown
					? { top: `calc(${y}% + ${inset})` }
					: { bottom: `calc(${100 - y}% + ${inset})` }),
				// Unfolds out of the dot it belongs to.
				transformOrigin: `${opensDown ? "top" : "bottom"} ${opensRight ? "left" : "right"}`,
			}}
			className={cn(
				"absolute rounded-md border bg-popover p-3 text-left text-sm text-popover-foreground shadow-md transition-[opacity,scale,translate] duration-700 ease-in-out motion-reduce:transition-none",
				faculty.length > LONG_FACULTY_NAME
					? "w-max max-w-[27rem] min-w-56"
					: "w-56",
				!visible && "translate-y-1 scale-[0.97] opacity-0",
			)}
		>
			<div className="mb-2 flex flex-wrap items-start gap-2">
				<div className="font-medium leading-tight">{name}</div>
				<Badge
					variant="secondary"
					className={cn(
						"shrink whitespace-normal justify-start rounded-xl",
						facultyColors.bg,
						facultyColors.text,
						facultyColors.border,
					)}
				>
					{faculty}
				</Badge>
			</div>
			<div className="space-y-1 text-muted-foreground">
				<div className="flex justify-between gap-4">
					<span>Корисність:</span>
					<span className={cn("font-medium", getUsefulnessTone(usefulness))}>
						{usefulness.toFixed(TOOLTIP_DECIMAL_PLACES)}
					</span>
				</div>
				<div className="flex justify-between gap-4">
					<span>Складність:</span>
					<span className={cn("font-medium", getDifficultyTone(difficulty))}>
						{difficulty.toFixed(TOOLTIP_DECIMAL_PLACES)}
					</span>
				</div>
				<div className="flex justify-between gap-4">
					<span>Відгуків:</span>
					<span className="font-medium text-foreground">{ratingsCount}</span>
				</div>
			</div>
		</div>
	);
}

function MapBackdrop() {
	const [hoveredDot, setHoveredDot] = useState<number | null>(null);
	// Hovering takes over from the carousel, which moves on to its next dot a moment
	// after the pointer leaves. Both drive the same transitions, so one fades into the
	// other.
	const spotlightDot = useSpotlightDot(hoveredDot !== null);
	const activeDot = hoveredDot ?? spotlightDot;

	return (
		<div aria-hidden="true">
			<div className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,transparent_30%,black_72%)]">
				<div className="absolute inset-0 hidden [background-image:linear-gradient(var(--color-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-border)_1px,transparent_1px)] [background-size:20%_25%] opacity-60 sm:block" />
				{DOTS.map(([x, y, tone, , , , , ratingsCount], index) => (
					<span
						key={`${x}-${y}`}
						onMouseEnter={() => setHoveredDot(index)}
						onMouseLeave={() => setHoveredDot(null)}
						style={{
							left: `${x}%`,
							top: `${y}%`,
							width: `${dotSize(ratingsCount)}rem`,
							height: `${dotSize(ratingsCount)}rem`,
						}}
						className={cn(
							"absolute -translate-1/2 transition-[scale] duration-700 ease-in-out motion-reduce:transition-none xl:pointer-events-auto",
							// Grows like a hovered point on the map while its tooltip is up.
							activeDot === index && "xl:scale-115",
						)}
					>
						<span
							style={{ animationDelay: `${index * 35}ms` }}
							className={cn(
								"block size-full rounded-full animate-in fade-in-0 zoom-in-0 fill-mode-backwards duration-500 ease-out motion-reduce:animate-none",
								tone,
							)}
						/>
					</span>
				))}
			</div>
			<div className="pointer-events-none absolute inset-0 -z-10 hidden xl:block">
				{DOTS.map(([x, y], index) => (
					<CourseTooltip
						key={`${x}-${y}`}
						dot={index}
						visible={activeDot === index}
					/>
				))}
			</div>
		</div>
	);
}

export function AuthShell({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-background">
			<MapBackdrop />
			{/* Empty areas let the pointer through to the dots behind. */}
			<div className="pointer-events-none grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4">
				<span aria-hidden="true" />
				<span className="pointer-events-auto">
					<Logo />
				</span>
				<span className="flex justify-end">
					<span className="pointer-events-auto">
						<ModeToggle />
					</span>
				</span>
			</div>
			<main className="pointer-events-none flex flex-1 items-center justify-center px-6 pb-16">
				<div className="pointer-events-auto w-full max-w-sm space-y-6 text-center">
					{children}
				</div>
			</main>
		</div>
	);
}

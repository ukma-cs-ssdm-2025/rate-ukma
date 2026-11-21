import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Logo } from "@/components/Logo";
import { ModeToggle } from "@/components/ModeToggle";
import { Badge } from "@/components/ui/Badge";
import { getDifficultyTone, getUsefulnessTone } from "@/lib/score-tone";
import { getFacultyColors } from "@/lib/faculty-colors";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { DOTS, dotSize } from "./authShellDots";

const SPOTLIGHTS = [0, 8, 2, 13, 5, 11, 10];

const EDGE_ZONE = 17;
const BOTTOM_ZONE = 80;
const LONG_FACULTY_NAME = 50;

export const SPOTLIGHT_START_MS = 1200;
export const SPOTLIGHT_SHOW_MS = 3200;
export const SPOTLIGHT_REST_MS = 900;
export const SPOTLIGHT_RESUME_MS = 2000;
const TOOLTIP_DECIMAL_PLACES = 2;

const SPOTLIGHT_MEDIA =
	"(min-width: 80rem) and (min-height: 38rem) and (prefers-reduced-motion: no-preference)";

function useSpotlightDot(paused: boolean) {
	const [enabled, setEnabled] = useState(false);
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

const TOOLTIP_MARGIN_PX = 8;
const OPENS_DOWN_ABOVE = 55;

type TooltipBox = {
	cardWidth: number;
	cardHeight: number;
	shellWidth: number;
	shellHeight: number;
	rem: number;
};

function useTooltipBox() {
	const ref = useRef<HTMLDivElement>(null);
	const [box, setBox] = useState<TooltipBox | null>(null);

	useEffect(() => {
		const card = ref.current;
		const shell = card?.offsetParent;
		if (
			!card ||
			!(shell instanceof HTMLElement) ||
			!globalThis.ResizeObserver
		) {
			return;
		}
		const measure = () => {
			const next = {
				cardWidth: card.offsetWidth,
				cardHeight: card.offsetHeight,
				shellWidth: shell.clientWidth,
				shellHeight: shell.clientHeight,
				rem: Number.parseFloat(
					getComputedStyle(document.documentElement).fontSize,
				),
			};
			const laidOut = next.cardHeight > 0 && next.shellHeight > 0;
			setBox((current) => {
				if (!laidOut) {
					return null;
				}
				const unchanged =
					current !== null &&
					current.cardWidth === next.cardWidth &&
					current.cardHeight === next.cardHeight &&
					current.shellWidth === next.shellWidth &&
					current.shellHeight === next.shellHeight &&
					current.rem === next.rem;
				return unchanged ? current : next;
			});
		};
		const observer = new ResizeObserver(measure);
		observer.observe(card);
		observer.observe(shell);
		return () => observer.disconnect();
	}, []);

	return [ref, box] as const;
}

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(value, max));
}

function CourseTooltip({
	dot,
	visible,
}: Readonly<{ dot: number; visible: boolean }>) {
	const [x, y, , name, faculty, usefulness, difficulty, ratingsCount] =
		DOTS[dot];
	const facultyColors = getFacultyColors(faculty);
	const [ref, box] = useTooltipBox();
	const insetRem = dotSize(ratingsCount) * 0.3;
	const opensRight =
		y >= BOTTOM_ZONE
			? x < 50
			: x < EDGE_ZONE || (x >= 50 && x <= 100 - EDGE_ZONE);
	let opensDown = y <= OPENS_DOWN_ABOVE;
	let position: { left: number; top: number } | null = null;
	if (box) {
		const inset = insetRem * box.rem;
		const dotLeft = (box.shellWidth * x) / 100;
		const dotTop = (box.shellHeight * y) / 100;
		const roomBelow = box.shellHeight - dotTop - inset - TOOLTIP_MARGIN_PX;
		const roomAbove = dotTop - inset - TOOLTIP_MARGIN_PX;
		const roomPreferred = opensDown ? roomBelow : roomAbove;
		const roomOpposite = opensDown ? roomAbove : roomBelow;
		if (box.cardHeight > roomPreferred && roomOpposite > roomPreferred) {
			opensDown = !opensDown;
		}
		position = {
			left: clamp(
				opensRight ? dotLeft + inset : dotLeft - inset - box.cardWidth,
				TOOLTIP_MARGIN_PX,
				Math.max(
					TOOLTIP_MARGIN_PX,
					box.shellWidth - box.cardWidth - TOOLTIP_MARGIN_PX,
				),
			),
			top: clamp(
				opensDown ? dotTop + inset : dotTop - inset - box.cardHeight,
				TOOLTIP_MARGIN_PX,
				Math.max(
					TOOLTIP_MARGIN_PX,
					box.shellHeight - box.cardHeight - TOOLTIP_MARGIN_PX,
				),
			),
		};
	}
	return (
		<div
			ref={ref}
			data-testid={testIds.authShell.tooltip}
			data-state={visible ? "open" : "closed"}
			style={{
				...(position ?? {
					...(opensRight
						? { left: `calc(${x}% + ${insetRem}rem)` }
						: { right: `calc(${100 - x}% + ${insetRem}rem)` }),
					...(opensDown
						? { top: `calc(${y}% + ${insetRem}rem)` }
						: { bottom: `calc(${100 - y}% + ${insetRem}rem)` }),
				}),
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
	const spotlightDot = useSpotlightDot(hoveredDot !== null);
	const activeDot = hoveredDot ?? spotlightDot;

	return (
		<div aria-hidden="true">
			<div className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,transparent_30%,black_72%)]">
				<div className="absolute inset-0 hidden [background-image:linear-gradient(var(--color-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-border)_1px,transparent_1px)] [background-size:20%_25%] opacity-60 sm:block" />
				{DOTS.map(([x, y, tone, , , , , ratingsCount], index) => (
					<span
						key={`${x}-${y}`}
						data-testid={testIds.authShell.dot}
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

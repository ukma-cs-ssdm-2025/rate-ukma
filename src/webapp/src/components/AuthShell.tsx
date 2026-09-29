import type { ReactNode } from "react";

import { Logo } from "@/components/Logo";
import { ModeToggle } from "@/components/ModeToggle";
import { cn } from "@/lib/utils";

// Echoes the course map: each dot is a course, placed and sized like on the map.
// Positions are percentages, so the scatter fits any screen without cropping.
const DOTS = [
	[11, 22, 3.2, "bg-primary/30"],
	[19, 64, 2.2, "bg-term-fall/35"],
	[8, 78, 4.4, "bg-term-spring/30"],
	[26, 12, 1.8, "bg-term-summer/40"],
	[15, 44, 1.6, "bg-primary/25"],
	[5, 52, 2.6, "bg-term-summer/30"],
	[23, 86, 2, "bg-primary/25"],
	[80, 18, 4, "bg-term-spring/30"],
	[91, 40, 2.4, "bg-primary/30"],
	[74, 70, 3, "bg-term-fall/30"],
	[95, 82, 1.8, "bg-term-summer/40"],
	[85, 58, 1.6, "bg-primary/25"],
	[70, 34, 2, "bg-term-summer/30"],
	[89, 10, 1.4, "bg-term-fall/35"],
	[78, 90, 2.4, "bg-primary/20"],
	[38, 94, 1.6, "bg-term-spring/30"],
	[61, 6, 1.8, "bg-primary/25"],
] as const;

function MapBackdrop() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,transparent_30%,black_72%)]"
		>
			<div className="absolute inset-0 hidden [background-image:linear-gradient(var(--color-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-border)_1px,transparent_1px)] [background-size:20%_25%] opacity-60 sm:block" />
			{DOTS.map(([x, y, size, tone], index) => (
				<span
					key={`${x}-${y}`}
					style={{
						left: `${x}%`,
						top: `${y}%`,
						width: `${size}rem`,
						height: `${size}rem`,
						animationDelay: `${index * 35}ms`,
					}}
					className={cn(
						"absolute -translate-1/2 rounded-full animate-in fade-in-0 zoom-in-0 fill-mode-backwards duration-500 ease-out motion-reduce:animate-none",
						tone,
					)}
				/>
			))}
		</div>
	);
}

export function AuthShell({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-background">
			<MapBackdrop />
			<div className="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4">
				<span aria-hidden="true" />
				<Logo />
				<span className="flex justify-end">
					<ModeToggle />
				</span>
			</div>
			<main className="flex flex-1 items-center justify-center px-6 pb-16">
				<div className="w-full max-w-sm space-y-6 text-center">{children}</div>
			</main>
		</div>
	);
}

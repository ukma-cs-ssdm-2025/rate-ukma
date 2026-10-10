import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/Button";
import { useRatingFlowEnabled } from "@/features/ratings/hooks/useRatingFlowEnabled";
import { cn } from "@/lib/utils";

// Prototype data: share of each faculty's students who rated this semester.
// A real version needs an aggregate endpoint.
const SEMESTER = "Осінь 2026";
const GOAL = 15;
const MY_FACULTY = "ФСНСТ";
const FACULTIES = [
	{ name: "ФІ", percent: 14 },
	{ name: "ФСНСТ", percent: 9 },
	{ name: "ФЕН", percent: 6 },
	{ name: "ФГН", percent: 5 },
	{ name: "ФОЗ", percent: 3 },
	{ name: "ФПрН", percent: 3 },
	{ name: "ФПвН", percent: 2 },
] as const;

const SCALE = Math.max(GOAL, ...FACULTIES.map((faculty) => faculty.percent));

/** A shared goal per faculty instead of a personal score. */
export function FacultyProgress() {
	const flowEnabled = useRatingFlowEnabled();
	if (!flowEnabled) return null;

	const mine = FACULTIES.find((faculty) => faculty.name === MY_FACULTY);
	const place =
		FACULTIES.findIndex((faculty) => faculty.name === MY_FACULTY) + 1;
	if (!mine) return null;

	return (
		<section
			aria-label="Оцінювання семестру за факультетами"
			className="grid gap-5 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-end sm:gap-8 sm:p-5"
		>
			<div className="space-y-4">
				<div className="space-y-1">
					<p className="text-sm text-muted-foreground">
						{SEMESTER}: оцінювання триває
					</p>
					<h2 className="text-lg leading-snug font-semibold">
						{MY_FACULTY} на {place} місці
					</h2>
					<p className="text-sm text-muted-foreground">
						Оцінили {mine.percent}% студентів, ціль семестру {GOAL}%
					</p>
				</div>
				<div
					role="progressbar"
					aria-label={`${MY_FACULTY}: ${mine.percent}% з цілі ${GOAL}%`}
					aria-valuemin={0}
					aria-valuemax={GOAL}
					aria-valuenow={mine.percent}
					className="h-2 overflow-hidden rounded-full bg-muted"
				>
					<div
						className="h-full rounded-full bg-primary"
						style={{ width: `${Math.min(100, (mine.percent / GOAL) * 100)}%` }}
					/>
				</div>
				<Button asChild size="sm">
					<Link to="/my-ratings">Оцінити свої дисципліни</Link>
				</Button>
			</div>

			<div className="h-32">
				<ol
					aria-label="Частка студентів, які оцінили"
					className="grid h-full grid-cols-7 items-end gap-2"
				>
					{FACULTIES.map((faculty) => {
						const isMine = faculty.name === MY_FACULTY;
						return (
							<li
								key={faculty.name}
								className="flex h-full min-w-0 flex-col items-center justify-end gap-1"
							>
								<span
									className={cn(
										"text-xs tabular-nums",
										isMine
											? "font-semibold text-primary"
											: "text-muted-foreground",
									)}
								>
									{faculty.percent}%
								</span>
								<div
									className={cn(
										"w-full max-w-10 rounded-t-md",
										isMine ? "bg-primary" : "bg-primary/25",
									)}
									style={{ height: `${(faculty.percent / SCALE) * 5.5}rem` }}
								/>
								<span
									className={cn(
										"h-4 truncate text-xs",
										isMine ? "font-semibold" : "text-muted-foreground",
									)}
								>
									{faculty.name}
								</span>
							</li>
						);
					})}
				</ol>
			</div>
		</section>
	);
}

import { useState } from "react";

import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/features/ratings/components/MyRatingsHeader";
import { useSavedRateProgress } from "./useRateQueue";

/**
 * Floats over a course page the student opened mid-queue, so reading its
 * reviews is a detour, not the end of rating.
 */
export function RateResumeBar() {
	const progress = useSavedRateProgress();
	const [hidden, setHidden] = useState(false);
	if (!progress || hidden) return null;

	return (
		<>
			{/* With the page's own bottom padding, room for the bar over its last line. */}
			<div aria-hidden="true" className="h-6" />
			<div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
				<aside
					aria-label="Оцінювання дисциплін"
					className="pointer-events-auto flex w-full max-w-md animate-in items-center gap-3 rounded-xl border bg-background py-2 pr-2 pl-4 shadow-lg duration-300 fade-in-0 slide-in-from-bottom-4 motion-reduce:animate-none"
				>
					<div className="min-w-0 flex-1">
						<p className="text-sm font-medium">
							Оцінено {progress.rated} з {progress.total}
						</p>
						<ProgressBar
							share={progress.rated / progress.total}
							className="mt-1.5 w-full"
						/>
					</div>
					<Button size="sm" asChild className="shrink-0">
						<Link to="/rate">Продовжити</Link>
					</Button>
					<Button
						size="icon-sm"
						variant="ghost"
						aria-label="Сховати"
						className="shrink-0 text-muted-foreground"
						onClick={() => setHidden(true)}
					>
						<X />
					</Button>
				</aside>
			</div>
		</>
	);
}

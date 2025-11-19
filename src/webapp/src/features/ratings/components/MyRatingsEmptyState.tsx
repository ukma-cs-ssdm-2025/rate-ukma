import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/Button";

export function MyRatingsEmptyState() {
	return (
		<div className="py-16 text-center">
			<div className="mx-auto max-w-sm space-y-4">
				<div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
					<Star className="h-10 w-10 text-muted-foreground" />
				</div>
				<div>
					<h3 className="text-lg font-semibold">Ще немає оцінок</h3>
					<p className="text-sm text-muted-foreground">
						Знайдіть курс у каталозі та залиште свою першу оцінку.
					</p>
				</div>
				<div className="flex justify-center">
					<Button asChild>
						<Link to="/">Перейти до курсів</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}

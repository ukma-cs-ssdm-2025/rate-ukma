import { Link } from "@tanstack/react-router";
import { Newspaper } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { testIds } from "@/lib/test-ids";

export function FeedEmptyState() {
	return (
		<div className="py-16 text-center" data-testid={testIds.feed.emptyState}>
			<div className="mx-auto max-w-sm space-y-4">
				<div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
					<Newspaper className="h-10 w-10 text-muted-foreground" />
				</div>
				<div>
					<h3 className="text-lg font-semibold">Тут поки що порожньо</h3>
					<p className="text-sm text-muted-foreground">
						Щойно з'являться нові відгуки чи оголошення, вони будуть тут.
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

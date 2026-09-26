import { Link } from "@tanstack/react-router";
import { Newspaper } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { testIds } from "@/lib/test-ids";

export function FeedEmptyState() {
	return (
		<Empty className="border-0 py-16" data-testid={testIds.feed.emptyState}>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Newspaper />
				</EmptyMedia>
				<EmptyTitle>Тут поки що порожньо</EmptyTitle>
				<EmptyDescription>
					Щойно з'являться нові відгуки чи оголошення, вони будуть тут.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild>
					<Link to="/">Перейти до курсів</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}

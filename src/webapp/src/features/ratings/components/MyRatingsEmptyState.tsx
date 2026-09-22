import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";

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

export function MyRatingsEmptyState() {
	return (
		<Empty
			className="border-0 py-16"
			data-testid={testIds.myRatings.emptyState}
		>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Star />
				</EmptyMedia>
				<EmptyTitle>Ще немає оцінок</EmptyTitle>
				<EmptyDescription>
					Знайдіть курс у каталозі та залиште свою першу оцінку.
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

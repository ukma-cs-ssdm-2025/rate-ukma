import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

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
					<BookOpen />
				</EmptyMedia>
				<EmptyTitle>Курсів поки немає</EmptyTitle>
				<EmptyDescription>
					Тут з'являться курси, які ви слухаєте, щойно вони будуть у системі. А
					поки можна почитати відгуки інших студентів.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild>
					<Link to="/">Переглянути курси</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}

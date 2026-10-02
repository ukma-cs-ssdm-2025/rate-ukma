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
import { useCourseTerm } from "@/lib/course-term";

export function MyRatingsEmptyState() {
	const term = useCourseTerm();
	return (
		<Empty
			className="border-0 py-16"
			data-testid={testIds.myRatings.emptyState}
		>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<BookOpen />
				</EmptyMedia>
				<EmptyTitle>
					{term("Курсів поки немає", "Дисциплін поки немає")}
				</EmptyTitle>
				<EmptyDescription>
					{term(
						"Тут з'являться курси, які ви слухаєте, щойно вони будуть у системі.",
						"Тут з'являться дисципліни, які ви слухаєте, щойно вони будуть у системі.",
					)}{" "}
					А поки можна почитати відгуки інших студентів.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild>
					<Link to="/">
						{term("Переглянути курси", "Переглянути дисципліни")}
					</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}

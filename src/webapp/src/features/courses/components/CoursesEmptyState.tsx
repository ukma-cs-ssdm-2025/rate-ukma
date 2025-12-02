import { BookOpen } from "lucide-react";

import { testIds } from "@/lib/test-ids";

export function CoursesEmptyState() {
	return (
		<div className="text-center py-16" data-testid={testIds.courses.emptyState}>
			<div className="mx-auto max-w-sm">
				<div className="h-24 w-24 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
					<BookOpen className="h-12 w-12 text-muted-foreground" />
				</div>
				<h3 className="text-lg font-medium text-muted-foreground mb-1">
					Курси не знайдено
				</h3>
				<p className="text-sm text-muted-foreground">
					Наразі немає доступних курсів за вашим запитом
				</p>
			</div>
		</div>
	);
}

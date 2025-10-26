import { BookOpen } from "lucide-react";

export function CoursesEmptyState() {
	return (
		<div className="text-center py-16">
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

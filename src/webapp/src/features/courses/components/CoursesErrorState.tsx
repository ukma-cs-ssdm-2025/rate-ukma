import { BookOpen } from "lucide-react";

interface CoursesErrorStateProps {
	onRetry?: () => void;
}

export function CoursesErrorState({ onRetry }: CoursesErrorStateProps) {
	return (
		<div className="text-center py-16">
			<div className="mx-auto max-w-sm">
				<div className="h-24 w-24 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
					<BookOpen className="h-12 w-12 text-destructive" />
				</div>
				<h3 className="text-lg font-medium text-destructive mb-1">
					Помилка завантаження курсів
				</h3>
				<p className="text-sm text-muted-foreground">
					Не вдалося завантажити список курсів. Спробуйте оновити сторінку.
				</p>
				{onRetry ? (
					<button
						type="button"
						onClick={onRetry}
						className="mt-4 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground px-5 py-2"
					>
						Спробувати знову
					</button>
				) : null}
			</div>
		</div>
	);
}

import { ErrorState } from "@/components/ui/ErrorState";
import { testIds } from "@/lib/test-ids";
import { useCourseTerm } from "@/lib/course-term";

interface CoursesErrorStateProps {
	onRetry?: () => void;
}

export function CoursesErrorState({
	onRetry,
}: Readonly<CoursesErrorStateProps>) {
	const term = useCourseTerm();
	return (
		<ErrorState
			title={term(
				"Помилка завантаження курсів",
				"Помилка завантаження дисциплін",
			)}
			description={term(
				"Не вдалося завантажити список курсів. Спробуйте оновити сторінку.",
				"Не вдалося завантажити список дисциплін. Спробуйте оновити сторінку.",
			)}
			onRetry={onRetry}
			retryTestId={testIds.courses.retryButton}
			data-testid={testIds.courses.errorState}
		/>
	);
}

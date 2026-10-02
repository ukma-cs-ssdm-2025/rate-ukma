import { ErrorState } from "@/components/ui/ErrorState";
import { testIds } from "@/lib/test-ids";

interface CoursesErrorStateProps {
	onRetry?: () => void;
}

export function CoursesErrorState({
	onRetry,
}: Readonly<CoursesErrorStateProps>) {
	return (
		<ErrorState
			title="Помилка завантаження дисциплін"
			description="Не вдалося завантажити список дисциплін. Спробуйте оновити сторінку."
			onRetry={onRetry}
			retryTestId={testIds.courses.retryButton}
			data-testid={testIds.courses.errorState}
		/>
	);
}

import { BookOpen } from "lucide-react";

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
			title="Помилка завантаження курсів"
			description="Не вдалося завантажити список курсів. Спробуйте оновити сторінку."
			icon={BookOpen}
			onRetry={onRetry}
			retryTestId={testIds.courses.retryButton}
			data-testid={testIds.courses.errorState}
		/>
	);
}

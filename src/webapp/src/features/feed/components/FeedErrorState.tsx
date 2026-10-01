import { ErrorState } from "@/components/ui/ErrorState";
import { testIds } from "@/lib/test-ids";

interface FeedErrorStateProps {
	onRetry: () => void;
	isRetrying: boolean;
}

export function FeedErrorState({
	onRetry,
	isRetrying,
}: Readonly<FeedErrorStateProps>) {
	return (
		<ErrorState
			title="Не вдалося завантажити стрічку"
			description="Перевірте з'єднання або спробуйте ще раз пізніше."
			onRetry={onRetry}
			isRetrying={isRetrying}
			retryTestId={testIds.feed.retryButton}
			data-testid={testIds.feed.errorState}
		/>
	);
}

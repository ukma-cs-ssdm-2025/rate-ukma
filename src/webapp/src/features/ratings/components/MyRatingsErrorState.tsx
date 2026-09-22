import { ErrorState } from "@/components/ui/ErrorState";
import { testIds } from "@/lib/test-ids";

interface MyRatingsErrorStateProps {
	onRetry: () => void;
	isRetrying: boolean;
}

export function MyRatingsErrorState({
	onRetry,
	isRetrying,
}: Readonly<MyRatingsErrorStateProps>) {
	return (
		<ErrorState
			title="Не вдалося завантажити оцінки"
			description="Перевірте з'єднання або спробуйте ще раз пізніше."
			onRetry={onRetry}
			isRetrying={isRetrying}
			data-testid={testIds.myRatings.errorState}
		/>
	);
}

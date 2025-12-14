import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
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
		<div className="py-16 text-center" data-testid={testIds.myRatings.errorState}>
			<div className="mx-auto max-w-sm space-y-4">
				<div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
					<AlertTriangle className="h-10 w-10 text-destructive" />
				</div>
				<div>
					<h3 className="text-lg font-semibold">
						Не вдалося завантажити оцінки
					</h3>
					<p className="text-sm text-muted-foreground">
						Перевірте з'єднання або спробуйте ще раз пізніше.
					</p>
				</div>
				<div className="flex justify-center">
					<Button variant="outline" onClick={onRetry} disabled={isRetrying}>
						{isRetrying ? <Spinner className="mr-2" /> : null}
						Спробувати знову
					</Button>
				</div>
			</div>
		</div>
	);
}

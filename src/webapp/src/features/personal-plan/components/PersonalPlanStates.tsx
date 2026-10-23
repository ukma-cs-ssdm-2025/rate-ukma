import { UserX } from "lucide-react";

import { Skeleton } from "@/components/ui/Skeleton";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { ErrorState } from "@/components/ui/ErrorState";
import { testIds } from "@/lib/test-ids";

export function PersonalPlanNotStudentState() {
	return (
		<Empty className="border-0 py-16">
			<EmptyHeader className="max-w-md">
				<EmptyMedia variant="icon">
					<UserX />
				</EmptyMedia>
				<EmptyTitle>Ви не зареєстровані як студент</EmptyTitle>
				<EmptyDescription>
					Скласти ІНП можуть лише студенти. Зверніться до адміністратора, якщо
					це помилка.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

export function PersonalPlanErrorState({
	onRetry,
	isRetrying,
}: Readonly<{ onRetry: () => void; isRetrying: boolean }>) {
	return (
		<ErrorState
			title="Не вдалося завантажити ІНП"
			description="Перевірте з'єднання або спробуйте ще раз пізніше."
			onRetry={onRetry}
			isRetrying={isRetrying}
			data-testid={testIds.personalPlan.errorState}
		/>
	);
}

export function PersonalPlanSkeleton() {
	return (
		<div className="space-y-3" aria-busy="true">
			{Array.from({ length: 4 }, (_, index) => (
				<Skeleton key={index} className="h-14 rounded-xl" />
			))}
		</div>
	);
}

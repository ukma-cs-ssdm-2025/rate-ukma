import { createFileRoute, useRouter, useSearch } from "@tanstack/react-router";

import { ErrorState } from "@/components/ui/ErrorState";

type LoginFailedSearch = {
	technical?: string;
};

export const Route = createFileRoute("/login/failed")({
	component: LoginFailedPage,
	validateSearch: (search: Record<string, string>): LoginFailedSearch => ({
		technical: search.technical,
	}),
});

function LoginFailedPage() {
	const router = useRouter();
	const search = useSearch({ from: "/login/failed" });
	const isTechnicalError = search.technical === "1";

	const handleRetry = () => {
		router.navigate({ to: "/login" });
	};

	return (
		<ErrorState
			className="flex-none p-0"
			title={isTechnicalError ? "Технічна помилка" : "Немає доступу"}
			description={
				isTechnicalError
					? "Сталася технічна помилка під час спроби входу."
					: "Тільки студенти та викладачі НаУКМА можуть використовувати цю платформу."
			}
			onRetry={handleRetry}
		/>
	);
}

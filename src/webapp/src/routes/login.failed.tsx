import { createFileRoute, useRouter, useSearch } from "@tanstack/react-router";

import { Button } from "@/components/ui/Button";

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
		<div className="w-full space-y-6">
			<div className="space-y-2">
				<h1 className="text-2xl font-bold tracking-tight">
					{isTechnicalError ? "Технічна помилка" : "Немає доступу"}
				</h1>
				<p className="text-base text-muted-foreground">
					{isTechnicalError
						? "Сталася технічна помилка під час спроби входу."
						: "Тільки студенти та викладачі НаУКМА можуть використовувати цю платформу."}
				</p>
			</div>
			<Button onClick={handleRetry} className="h-11 w-full text-base font-medium">
				{isTechnicalError ? "Спробувати знову" : "Повернутися до входу"}
			</Button>
		</div>
	);
}

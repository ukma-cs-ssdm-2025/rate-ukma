import { createFileRoute, useRouter, useSearch } from "@tanstack/react-router";
import { AlertCircle, RotateCcw } from "lucide-react";

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
		<>
			<div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
				<AlertCircle className="h-8 w-8 text-destructive" />
			</div>

			<div className="space-y-4 mb-6">
				<h1 className="text-3xl font-bold text-foreground">
					{isTechnicalError ? "Технічна помилка" : "Немає доступу"}
				</h1>
				<p className="text-lg text-muted-foreground">
					{isTechnicalError
						? "Сталася технічна помилка під час спроби входу."
						: "Тільки студенти та викладачі НаУКМА можуть використовувати цю платформу."}
				</p>
			</div>

			<Button
				onClick={handleRetry}
				className="w-full gap-3 h-12 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-200"
				size="lg"
			>
				<RotateCcw className="h-5 w-5" />
				Спробувати знову
			</Button>
		</>
	);
}

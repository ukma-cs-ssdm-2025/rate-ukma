import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";

export const Route = createFileRoute("/my-ratings")({
	component: MyRatings,
});

function MyRatings() {
	return (
		<div className="space-y-8">
			<div className="text-center">
				<h1 className="text-4xl font-bold tracking-tight">Мої оцінки</h1>
				<p className="text-muted-foreground text-lg mt-2">
					Перегляньте та керуйте вашими оцінками курсів
				</p>
			</div>

			<div className="text-center py-16">
				<div className="mx-auto max-w-sm">
					<div className="h-24 w-24 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
						<Star className="h-12 w-12 text-muted-foreground" />
					</div>
					<h3 className="text-lg font-medium text-muted-foreground mb-1">
						Немає оцінок
					</h3>
					<p className="text-sm text-muted-foreground">
						Ви ще не оцінили жодного курсу
					</p>
				</div>
			</div>
		</div>
	);
}

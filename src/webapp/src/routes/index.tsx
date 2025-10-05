import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/")({
	component: Courses,
});

function Courses() {
	return (
		<div className="space-y-8">
			<div className="text-center">
				<h1 className="text-4xl font-bold tracking-tight">Курси</h1>
				<p className="text-muted-foreground text-lg mt-2">
					Переглядайте та оцінюйте курси в Києво-Могилянській Академії
				</p>
			</div>

			<div className="text-center py-16">
				<div className="mx-auto max-w-sm">
					<div className="h-24 w-24 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
						<BookOpen className="h-12 w-12 text-muted-foreground" />
					</div>
					<h3 className="text-lg font-medium text-muted-foreground mb-1">
						Курси поки недоступні
					</h3>
					<p className="text-sm text-muted-foreground">
						Каталог курсів буде доступний найближчим часом
					</p>
				</div>
			</div>
		</div>
	);
}

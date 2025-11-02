import { BookOpen, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDifficultyTone, getUsefulnessTone } from "../courseFormatting";

interface CourseStatsCardsProps {
	difficulty: number | null;
	usefulness: number | null;
	ratingsCount: number | null;
}

export function CourseStatsCards({
	difficulty,
	usefulness,
	ratingsCount,
}: CourseStatsCardsProps) {
	return (
		<div className="grid gap-4 md:grid-cols-3">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Складність</CardTitle>
					<TrendingUp className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-center">
						<div
							className={`text-3xl font-bold ${getDifficultyTone(difficulty)}`}
						>
							{difficulty?.toFixed(1) ?? "—"}
						</div>
						<p className="text-xs text-muted-foreground mt-1">з 5.0</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Корисність</CardTitle>
					<TrendingUp className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-center">
						<div
							className={`text-3xl font-bold ${getUsefulnessTone(usefulness)}`}
						>
							{usefulness?.toFixed(1) ?? "—"}
						</div>
						<p className="text-xs text-muted-foreground mt-1">з 5.0</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Відгуків</CardTitle>
					<BookOpen className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-center">
						<div className="text-3xl font-bold">{ratingsCount}</div>
						<p className="text-xs text-muted-foreground mt-1">
							{ratingsCount === 1
								? "відгук"
								: (ratingsCount ?? 0) < 5
									? "відгуки"
									: "відгуків"}
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

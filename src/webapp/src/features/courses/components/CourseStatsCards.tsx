import { BookOpen, TrendingUp } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import {
	difficultyDescriptions,
	usefulnessDescriptions,
} from "../../ratings/definitions/ratingDefinitions";
import { getDifficultyTone, getUsefulnessTone } from "../courseFormatting";

const SKELETON_STATS_COUNT = 3;
const SKELETON_KEYS = Array.from(
	{ length: SKELETON_STATS_COUNT },
	(_, i) => `stats-skeleton-${i}`,
);

interface CourseStatsCardsProps {
	difficulty: number | null;
	usefulness: number | null;
	ratingsCount: number | null;
}

export function CourseStatsCards({
	difficulty,
	usefulness,
	ratingsCount,
}: Readonly<CourseStatsCardsProps>) {
	const getDescription = (
		value: number | null,
		type: "difficulty" | "usefulness" | "count",
	) => {
		if (type === "count") {
			if (!value) return "Поділіться своїм досвідом";
			if (value < 10) return "Перші враження";
			return "Активна спільнота";
		}

		if (value == null) return "Поки що недостатньо оцінок";

		if (type === "difficulty") {
			if (value < 2.5) return "Легше багатьох курсів";
			if (value < 3.5) return "Стандартне навантаження";
			return "Потребує більше часу";
		}

		if (value < 2.5) return "Можна покращити";
		if (value < 3.5) return "Знання застосовні";
		return "Дуже корисний курс";
	};

	const getDetailedDescription = (
		value: number | null,
		type: "difficulty" | "usefulness",
	) => {
		if (value == null) return "Недостатньо даних";

		const roundedValue = Math.round(value);
		const descriptions =
			type === "difficulty" ? difficultyDescriptions : usefulnessDescriptions;
		return descriptions[roundedValue as keyof typeof descriptions] || "";
	};

	const stats = [
		{
			title: "Складність",
			description: getDescription(difficulty, "difficulty"),
			value: difficulty,
			type: "difficulty" as const,
			formatted: difficulty?.toFixed(1) ?? "—",
			hint: difficulty == null ? "Недостатньо даних" : "з 5.0",
			icon: TrendingUp,
			accent: getDifficultyTone(difficulty),
		},
		{
			title: "Корисність",
			description: getDescription(usefulness, "usefulness"),
			value: usefulness,
			type: "usefulness" as const,
			formatted: usefulness?.toFixed(1) ?? "—",
			hint: usefulness == null ? "Недостатньо даних" : "з 5.0",
			icon: TrendingUp,
			accent: getUsefulnessTone(usefulness),
		},
		{
			title: "Відгуків",
			description: getDescription(ratingsCount, "count"),
			value: ratingsCount,
			formatted: ratingsCount?.toString() ?? "—",
			hint: (() => {
				if (ratingsCount == null) return "Недостатньо даних";
				if (ratingsCount === 1) return "відгук";
				if (ratingsCount < 5) return "відгуки";
				return "відгуків";
			})(),
			icon: BookOpen,
			accent:
				ratingsCount && ratingsCount > 0
					? "text-primary"
					: "text-muted-foreground",
		},
	];

	return (
		<div
			className="grid gap-4 sm:grid-cols-3"
			data-testid={testIds.courseDetails.statsCards}
		>
			{stats.map(
				(
					{ title, description, formatted, hint, accent, value, type },
					index,
				) => (
					<Card
						key={`${title}-${index.toString()}`}
						className="border border-border/50 bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
						title={
							type && value !== null
								? getDetailedDescription(value, type)
								: undefined
						}
					>
						<div className="space-y-2">
							<div className="flex items-baseline gap-1.5">
								<span
									className={cn(
										"text-3xl font-bold tabular-nums sm:text-4xl",
										accent,
									)}
								>
									{formatted}
								</span>
								<span className="text-xs text-muted-foreground">{hint}</span>
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium text-foreground">{title}</p>
								<p className="text-xs text-muted-foreground/60">
									{description}
								</p>
							</div>
						</div>
					</Card>
				),
			)}
		</div>
	);
}

export function CourseStatsCardsSkeleton() {
	return (
		<div className="grid gap-4 sm:grid-cols-3">
			{SKELETON_KEYS.map((key) => (
				<Card
					key={key}
					className="border border-border/50 bg-card p-5 shadow-sm"
				>
					<div className="space-y-2">
						<div className="flex items-baseline gap-1.5">
							<Skeleton className="h-10 w-16" />
							<Skeleton className="h-3 w-12" />
						</div>
						<div className="space-y-1">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-3 w-32" />
						</div>
					</div>
				</Card>
			))}
		</div>
	);
}

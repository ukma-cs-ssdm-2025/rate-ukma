import { createFileRoute, Link, useSearch } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { FocusVariant } from "@/features/rate-flow/FocusVariant";
import { MapVariant } from "@/features/rate-flow/MapVariant";
import { SplitVariant } from "@/features/rate-flow/SplitVariant";
import { useRateQueue } from "@/features/rate-flow/useRateQueue";
import { withAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

// Prototype: three takes on rating a whole semester, switchable with ?v=.
const VARIANTS = {
	split: "Два екрани",
	focus: "Картка за карткою",
	map: "Семестр на карті",
} as const;
type Variant = keyof typeof VARIANTS;

interface RateSearch {
	v?: Variant;
}

function RatePage() {
	const { v = "split" } = useSearch({ from: "/rate" });
	const queue = useRateQueue();

	return (
		<Layout>
			<div className="space-y-8">
				<PageHeader
					title="Оцінити семестр"
					description="Твої курси, які ще чекають на оцінку"
					actions={
						<nav className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
							{(Object.keys(VARIANTS) as Variant[]).map((key) => (
								<Link
									key={key}
									to="/rate"
									search={{ v: key }}
									className={cn(
										"rounded-md px-3 py-1",
										key === v && "bg-background font-medium shadow-sm",
									)}
								>
									{VARIANTS[key]}
								</Link>
							))}
						</nav>
					}
				/>
				{queue.isLoading || queue.items.length === 0 ? (
					<Skeleton className="h-96 w-full" />
				) : v === "focus" ? (
					<FocusVariant queue={queue} />
				) : v === "map" ? (
					<MapVariant queue={queue} />
				) : (
					<SplitVariant queue={queue} />
				)}
			</div>
		</Layout>
	);
}

export const Route = createFileRoute("/rate")({
	validateSearch: (search: Record<string, string>): RateSearch => ({
		v: search.v in VARIANTS ? (search.v as Variant) : undefined,
	}),
	component: withAuth(RatePage),
});

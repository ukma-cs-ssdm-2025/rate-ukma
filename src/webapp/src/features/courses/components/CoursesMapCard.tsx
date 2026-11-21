import { useState } from "react";

import { ChevronDown, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import type { CoursesListParams } from "@/lib/api/generated";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { localStorageAdapter } from "@/lib/storage";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { CoursesScatterPlot } from "./CoursesScatterPlot";

const MAP_COLLAPSED_STORAGE_KEY = "courses-map-collapsed";

export function CoursesMapCard({
	filters,
	onOpenFullscreen,
}: Readonly<{
	filters: CoursesListParams;
	onOpenFullscreen: () => void;
}>) {
	const [collapsed, setCollapsed] = useState<boolean>(
		() =>
			localStorageAdapter.getItem<boolean>(MAP_COLLAPSED_STORAGE_KEY) ?? false,
	);
	const isDesktop = useMediaQuery("(min-width: 768px)");

	if (!isDesktop) {
		return (
			<section
				aria-label="Карта дисциплін"
				className="overflow-hidden rounded-xl border bg-card shadow-sm plot-surface-card md:hidden"
			>
				<div className="flex items-center justify-between gap-2 px-4 pt-3">
					<h3 className="text-sm font-semibold">Карта дисциплін</h3>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 gap-2 text-muted-foreground"
						onClick={onOpenFullscreen}
						data-testid={testIds.courses.scatterPlotFullscreenButton}
					>
						<Maximize2 className="size-4" />
						Відкрити
					</Button>
				</div>
				<div className="relative mb-2 h-44">
					<div inert className="pointer-events-none absolute inset-0">
						<CoursesScatterPlot filters={filters} variant="mini" />
					</div>
				</div>
			</section>
		);
	}

	return (
		<Collapsible
			open={!collapsed}
			onOpenChange={(open) => {
				setCollapsed(!open);
				localStorageAdapter.setItem(MAP_COLLAPSED_STORAGE_KEY, !open);
			}}
			className="hidden overflow-hidden rounded-xl border bg-card shadow-sm plot-surface-card md:block"
		>
			<div className="flex min-h-10 items-center justify-between gap-2 px-4 py-1">
				<h3 className="text-sm font-semibold">Карта дисциплін</h3>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						className="h-8 gap-2 text-muted-foreground"
						onClick={onOpenFullscreen}
						data-testid={testIds.courses.scatterPlotFullscreenButton}
					>
						<Maximize2 className="size-4" />
						Повний екран
					</Button>
					<CollapsibleTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0"
							aria-label={collapsed ? "Розгорнути карту" : "Згорнути карту"}
						>
							<ChevronDown
								className={cn(
									"size-4 transition-transform duration-200 motion-reduce:transition-none",
									!collapsed && "rotate-180",
								)}
							/>
						</Button>
					</CollapsibleTrigger>
				</div>
			</div>
			<CollapsibleContent>
				<div className="mb-2 h-64">
					<CoursesScatterPlot filters={filters} variant="mini" />
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

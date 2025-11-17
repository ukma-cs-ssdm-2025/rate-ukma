import { BarChart3, Table2 } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";

export type ViewMode = "table" | "plot";

interface CoursesViewSwitcherProps {
	value: ViewMode;
	onValueChange: (value: ViewMode) => void;
}

export function CoursesViewSwitcher({
	value,
	onValueChange,
}: CoursesViewSwitcherProps) {
	return (
		<ToggleGroup
			type="single"
			value={value}
			onValueChange={(v) => {
				if (v) onValueChange(v as ViewMode);
			}}
			variant="outline"
			className="w-full sm:w-auto"
		>
			<ToggleGroupItem
				value="table"
				aria-label="Таблиця"
				className="flex-1 sm:flex-none gap-2"
			>
				<Table2 className="h-4 w-4" />
				<span className="hidden sm:inline">Таблиця</span>
			</ToggleGroupItem>
			<ToggleGroupItem
				value="plot"
				aria-label="Графік"
				className="flex-1 sm:flex-none gap-2"
			>
				<BarChart3 className="h-4 w-4" />
				<span className="hidden sm:inline">Графік</span>
			</ToggleGroupItem>
		</ToggleGroup>
	);
}

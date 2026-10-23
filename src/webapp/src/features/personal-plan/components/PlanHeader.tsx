import { PageHeader } from "@/components/PageHeader";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";
import { testIds } from "@/lib/test-ids";

type PlanView = "main" | "backups";

interface PlanHeaderProps {
	readonly showBackups: boolean;
	readonly backupCount: number;
	readonly onShowBackupsChange?: (showBackups: boolean) => void;
}

export function PlanHeader({
	showBackups,
	backupCount,
	onShowBackupsChange,
}: PlanHeaderProps) {
	return (
		<PageHeader
			title="Мій ІНП"
			description="Пройдені дисципліни та вибір на наступні роки"
			actions={
				onShowBackupsChange ? (
					<ToggleGroup
						type="single"
						variant="outline"
						size="sm"
						aria-label="Відображення"
						value={showBackups ? "backups" : "main"}
						onValueChange={(value: PlanView | "") => {
							// Clicking the active item would clear the group; keep it.
							if (value) onShowBackupsChange(value === "backups");
						}}
						data-testid={testIds.personalPlan.viewToggle}
					>
						<ToggleGroupItem value="main">Основні</ToggleGroupItem>
						<ToggleGroupItem value="backups">
							З запасними
							<span className="text-xs text-muted-foreground tabular-nums">
								{backupCount}
							</span>
						</ToggleGroupItem>
					</ToggleGroup>
				) : undefined
			}
		/>
	);
}

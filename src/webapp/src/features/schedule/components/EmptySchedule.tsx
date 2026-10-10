import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { InpEntry } from "@/features/schedule/core";

/** Before САЗ publishes a single file: the ІНП lines waiting for a schedule. */
export function EmptySchedule({
	entries,
}: {
	entries: ReadonlyArray<InpEntry>;
}) {
	return (
		<div className="min-h-0 flex-1 overflow-auto p-4">
			<Card data-testid="empty-schedule" className="border-dashed">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-sm">
						<CalendarDays className="size-4 text-muted-foreground" />
						Предмети з твого ІНП
					</CardTitle>
				</CardHeader>
				<CardContent>
					<ul className="divide-y divide-border/50">
						{entries.map((entry) => (
							<li
								key={entry.courseId}
								className="flex items-center justify-between gap-3 py-2.5"
							>
								<span className="min-w-0 truncate text-sm text-foreground">
									{entry.title}
								</span>
								<Badge
									variant="outline"
									className="shrink-0 text-muted-foreground"
								>
									без розкладу
								</Badge>
							</li>
						))}
					</ul>
				</CardContent>
			</Card>
		</div>
	);
}

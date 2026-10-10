import { Card } from "@/components/ui/Card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/Table";
import {
	formatDecimalValue,
	getSemesterDisplay,
} from "@/features/courses/courseFormatting";
import { cn } from "@/lib/utils";
import { MIN_RATED_TO_SHOW, type TeachingOffering } from "../types";

/** Every semester of the course side by side; a row opens that semester. */
export function OfferingHistory({
	offerings,
	selectedId,
	onSelect,
}: Readonly<{
	offerings: readonly TeachingOffering[];
	selectedId: string;
	onSelect: (id: string) => void;
}>) {
	return (
		<Card className="overflow-hidden shadow-sm">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="pl-4 sm:pl-5">Семестр</TableHead>
						<TableHead className="text-right">Оцінили</TableHead>
						<TableHead className="text-right">Складн.</TableHead>
						<TableHead className="pr-4 text-right sm:pr-5">Корисн.</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{offerings.map((offering) => {
						const hidden = offering.rated < MIN_RATED_TO_SHOW;
						const isSelected = offering.id === selectedId;
						return (
							<TableRow
								key={offering.id}
								aria-selected={isSelected}
								onClick={() => onSelect(offering.id)}
								className={cn(
									"cursor-pointer",
									isSelected && "bg-card-user hover:bg-card-user",
								)}
							>
								<TableCell className="pl-4 font-medium sm:pl-5">
									{getSemesterDisplay(offering.year, offering.term)}
								</TableCell>
								<TableCell className="text-right tabular-nums text-muted-foreground">
									{offering.rated} з {offering.enrolled}
								</TableCell>
								<TableCell
									className={cn(
										"text-right font-semibold tabular-nums",
										hidden && "text-muted-foreground",
									)}
								>
									{hidden ? "—" : formatDecimalValue(offering.avg_difficulty)}
								</TableCell>
								<TableCell
									className={cn(
										"pr-4 text-right font-semibold tabular-nums sm:pr-5",
										hidden && "text-muted-foreground",
									)}
								>
									{hidden ? "—" : formatDecimalValue(offering.avg_usefulness)}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</Card>
	);
}

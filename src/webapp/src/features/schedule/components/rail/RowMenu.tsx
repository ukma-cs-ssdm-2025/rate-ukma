import {
	CalendarPlus,
	Ellipsis,
	Eye,
	EyeOff,
	FileText,
	Focus,
	X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

interface Props {
	/** Test id suffix and aria subject. */
	id: string;
	name: string;
	hidden: boolean;
	onToggleHidden: () => void;
	/** Present only for disciplines with lessons on the grid. */
	solo?: { readonly active: boolean; readonly toggle: () => void };
	/** Present only for disciplines the student added by hand; ІНП ones stay. */
	onRemove?: () => void;
	/** Other published streams of the same ІНП line, by sheet: switching
	 *  swaps this discipline for that one in the plan. */
	streams?: ReadonlyArray<{
		readonly id: string;
		readonly label: string;
		readonly current: boolean;
	}>;
	onSwitchStream?: (id: string) => void;
	/** Add a lesson by hand: for a line no sheet prints, or one more pair of
	 *  the student's own discipline. */
	onAddLesson?: { readonly label: string; readonly run: () => void };
}

/** Everything one can do to one discipline, behind one «⋯» that appears
 *  on hover. Hiding is for the whole plan (grid and calendars alike);
 *  «лише ця» is a lens for comparing this discipline's groups. */
export function RowMenu({
	id,
	name,
	hidden,
	onToggleHidden,
	solo,
	onRemove,
	streams,
	onSwitchStream,
	onAddLesson,
}: Props) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon-xs"
					aria-label={`Дії: ${name}`}
					data-testid={`row-menu-${id}`}
					className="shrink-0 rounded-full text-muted-foreground/60 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 max-lg:opacity-70 pointer-coarse:opacity-70"
				>
					<Ellipsis className="size-3.5" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-60">
				{solo && (
					<DropdownMenuItem data-testid={`solo-${id}`} onSelect={solo.toggle}>
						<Focus />{" "}
						{solo.active ? "Показати всі дисципліни" : "Лише ця дисципліна"}
					</DropdownMenuItem>
				)}
				{onAddLesson && (
					<DropdownMenuItem
						data-testid={`add-lesson-${id}`}
						onSelect={onAddLesson.run}
					>
						<CalendarPlus /> {onAddLesson.label}
					</DropdownMenuItem>
				)}
				<DropdownMenuItem data-testid={`hide-${id}`} onSelect={onToggleHidden}>
					{hidden ? (
						<>
							<Eye /> Показати знову
						</>
					) : (
						<>
							<EyeOff /> Сховати: із сітки й календарів
						</>
					)}
				</DropdownMenuItem>
				{streams && streams.length > 1 && onSwitchStream && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuLabel className="text-mini text-muted-foreground">
							Потік: з якого розкладу пари
						</DropdownMenuLabel>
						{streams.map((stream) => (
							<DropdownMenuItem
								key={stream.id}
								data-testid={`stream-${stream.id}`}
								disabled={stream.current}
								onSelect={() => onSwitchStream(stream.id)}
							>
								<FileText /> {stream.label}
								{stream.current && (
									<span className="ml-auto text-mini text-muted-foreground">
										зараз
									</span>
								)}
							</DropdownMenuItem>
						))}
					</>
				)}
				{onRemove && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							data-testid={`remove-${id}`}
							onSelect={onRemove}
							variant="destructive"
						>
							<X /> Прибрати з плану
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

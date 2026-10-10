import type { DisciplineId } from "@/features/schedule/core";
import { sheetsOf } from "@/features/schedule/core";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import type { Semester } from "@/features/schedule/lib/data";
import {
	provenanceHint,
	provenanceText,
	provenanceUnsure,
	shortSheet,
	type Provenance,
} from "@/features/schedule/lib/provenance";

/** «ПМ БП-3», «КН БП-4, ще 1»: which sheet these lessons come from. When
 *  other streams exist the badge is a menu of them, so switching works
 *  wherever the badge is: the rail row, the grid cell, the phone row and
 *  the phone sheet. Same primitive as every other menu in the app. */
export function SheetBadge(props: {
	provenance: Provenance;
	disciplineId: DisciplineId;
	semester: Pick<Semester, "files" | "offerings">;
	/** Absent in view mode: the badge then only explains. */
	onSwitch?: (to: DisciplineId) => void;
	tone?: "default" | "inverse";
	className?: string;
}) {
	const {
		provenance,
		disciplineId,
		semester,
		onSwitch,
		tone = "default",
		className = "",
	} = props;
	// An own lesson comes from no sheet; there is nothing to name.
	if (provenance.sheets.length === 0) return null;
	// A locked plan is the student's word: the badge only says where the
	// lessons are, never «перевір».
	const settled = onSwitch === undefined;
	const text = provenanceText(provenance, { settled });
	const unsure = !settled && provenanceUnsure(provenance);
	const switchable = !settled && provenance.alternatives.length > 0;
	const hint = provenanceHint(provenance, { settled });
	const pill = (
		<Badge
			variant={
				tone === "inverse" ? "inverse" : unsure ? "warning" : "secondary"
			}
			data-testid={`sheet-${disciplineId}`}
			data-foreign={provenance.foreign || undefined}
			data-basis={provenance.basis}
			title={switchable ? undefined : hint}
			className={`h-4 max-w-full rounded-sm px-1.5 text-mini ${switchable ? "cursor-pointer" : ""} ${className}`}
		>
			{unsure && <TriangleAlert />}
			<span className="truncate">{text}</span>
			{switchable && <ChevronDown className="opacity-70" />}
		</Badge>
	);
	if (!switchable) return pill;

	const labels = new Map(
		semester.files.map((file) => [file.source, file.label]),
	);
	const labelOf = (id: DisciplineId) => {
		const offering = semester.offerings.find((o) => o.disciplineId === id);
		return offering
			? sheetsOf(offering, (source) => labels.get(source) ?? source)
					.map(shortSheet)
					.join(", ")
			: id;
	};
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label={`Потік: ${text}. Змінити`}
				onClick={(click) => click.stopPropagation()}
				// Lifted over a lesson card's stretched choose button; a plain pill
				// stays under it, so a tap on the pill still chooses the group.
				className="relative z-10 max-w-full rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
				data-testid={`streams-${disciplineId}`}
			>
				{pill}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56" title={hint}>
				<DropdownMenuLabel className="text-mini text-muted-foreground">
					Розклад, з якого пари
				</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={disciplineId}
					// SAFETY: item values are the discipline ids listed right below.
					onValueChange={(id) => onSwitch(id as DisciplineId)}
				>
					{[disciplineId, ...provenance.alternatives].map((id) => (
						<DropdownMenuRadioItem
							key={id}
							value={id}
							data-testid={`stream-${id}`}
						>
							<span className="min-w-0 flex-1 truncate">{labelOf(id)}</span>
							{id === provenance.ownStream && (
								<span className="text-mini text-muted-foreground">твій</span>
							)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

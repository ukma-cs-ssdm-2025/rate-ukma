import type { Ref } from "react";

import { ArrowLeftRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import type { SyncChange } from "@/lib/api/generated";
import { changeTitle, parseDisplay } from "../sync";
import type { SyncDisplayCourse } from "../sync";
import { titleDiff } from "../syncReview";
import { RatedChip } from "./SyncStepRow";

function courseMeta(course: SyncDisplayCourse | null): string {
	if (course === null) {
		return "";
	}
	return [
		course.saz_codes.slice(0, 2).join(", "),
		course.years.length > 0
			? `${Math.min(...course.years)}–${Math.max(...course.years)}`
			: "",
		course.department ?? "",
	]
		.filter((part) => part.length > 0)
		.join(" · ");
}

function DiffTitle({ base, other }: Readonly<{ base: string; other: string }>) {
	const diff = titleDiff(base, other);
	if (diff.changed.length === 0 && base.length === other.length) {
		return <>«{other}»</>;
	}
	return (
		<>
			«{diff.prefix}
			<mark className="rounded-sm bg-caution px-0.5 text-caution-foreground">
				{diff.changed.length > 0 ? diff.changed : "·"}
			</mark>
			{diff.suffix}»
		</>
	);
}

interface ChangeRowProps {
	change: SyncChange;
	selected: boolean;
	selectable: boolean;
	onSelect: (selected: boolean) => void;
	onOpen: () => void;
	ref?: Ref<HTMLButtonElement>;
}

export function SyncChangeRow({
	change,
	selected,
	selectable,
	onSelect,
	onOpen,
	ref,
}: Readonly<ChangeRowProps>) {
	const display = parseDisplay(change);
	const title = changeTitle(change, display);
	const ukma = display.ukmaCourse;
	const meta = courseMeta(display.course);
	const checkboxId = `sync-row-${change.id}`;
	return (
		<li className="flex items-start gap-3 border-b px-1 py-3 last:border-b-0">
			<Checkbox
				id={checkboxId}
				checked={selected}
				disabled={!selectable && !selected}
				onCheckedChange={(value) => onSelect(value === true)}
				aria-label={`Вибрати: ${title}`}
				className="mt-1"
			/>
			<div className="min-w-0 flex-1 space-y-1 text-sm">
				<p className="break-words">
					<span className="text-muted-foreground">Rate UKMA </span>
					<span className="font-medium">«{title}»</span>
				</p>
				{meta.length > 0 ? (
					<p className="text-xs text-muted-foreground tabular-nums">{meta}</p>
				) : null}
				{ukma === null ? null : (
					<p className="flex items-start gap-1.5 break-words">
						<ArrowLeftRight
							className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
							aria-label="відповідає"
						/>
						<span>
							<span className="text-muted-foreground">UKMA Data </span>
							<DiffTitle base={title} other={ukma.title} />
						</span>
					</p>
				)}
				<RatedChip ratings={change.ratings} plans={0} />
			</div>
			<Button
				ref={ref}
				variant="ghost"
				size="sm"
				onClick={onOpen}
				aria-label={`Деталі: ${title}`}
			>
				Деталі
			</Button>
		</li>
	);
}

import type { ReactNode } from "react";

import { Lock, Star } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import type { SyncChange } from "@/lib/api/generated";
import { fieldLabel, kindLabel, ratingLabel, stateLabel } from "../sync";
import type { SyncDisplay, SyncDisplayCourse } from "../syncDisplay";
import { formatFieldValue } from "../syncActions";
import { changedFields, changeTitle, parseDisplay } from "../syncDisplay";

function courseMeta(course: SyncDisplayCourse): string {
	return [
		course.department,
		course.years.length > 0 ? `роки ${course.years.join(", ")}` : null,
		course.saz_codes.length > 0 ? `САЗ ${course.saz_codes.join(", ")}` : null,
		course.ratings === null ? null : ratingLabel(course.ratings),
	]
		.filter((part): part is string => part !== null)
		.join(" · ");
}

function DisplayRows({ display }: Readonly<{ display: SyncDisplay }>) {
	const rows: string[] = [];
	if (display.course !== null) {
		const meta = courseMeta(display.course);
		if (meta.length > 0) {
			rows.push(meta);
		}
	}
	if (display.ukmaCourse !== null) {
		const namedElsewhere =
			display.course !== null ||
			display.name !== null ||
			display.teacherName !== null ||
			display.courses.length > 0;
		rows.push(
			[
				namedElsewhere ? display.ukmaCourse.title : null,
				"UKMA Data",
				display.ukmaCourse.department,
			]
				.filter((part): part is string => part !== null)
				.join(" · "),
		);
	}
	const titleNamesTheLoneCourse =
		display.teacherName === null &&
		display.course === null &&
		display.name === null &&
		display.ukmaCourse === null &&
		display.courses.length === 1;
	for (const course of display.courses) {
		const meta = courseMeta(course);
		rows.push(
			[
				titleNamesTheLoneCourse ? null : course.title,
				meta.length > 0 ? meta : null,
			]
				.filter((part): part is string => part !== null)
				.join(" — "),
		);
	}
	const visible = rows.filter((row) => row.length > 0);
	if (visible.length === 0) {
		return null;
	}
	return (
		<ul className="space-y-1 text-sm text-muted-foreground">
			{visible.map((row, index) => (
				<li key={`${index}-${row}`} className="break-words">
					{row}
				</li>
			))}
		</ul>
	);
}

function FieldDiff({
	change,
	display,
}: Readonly<{ change: SyncChange; display: SyncDisplay }>) {
	const fields = changedFields(change);
	if (fields.length === 0) {
		return null;
	}
	return (
		<dl className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-1 text-sm">
			{fields.map((field) => {
				const value = formatFieldValue(change, field, display);
				return (
					<div key={field.key} className="contents">
						<dt className="text-muted-foreground">{fieldLabel(field.key)}</dt>
						<dd className="min-w-0 break-words">
							<span className="text-muted-foreground line-through decoration-destructive/40">
								{value.before}
							</span>{" "}
							→ <span>{value.after}</span>
						</dd>
					</div>
				);
			})}
		</dl>
	);
}

export function SyncChangeCard({
	change,
	showState = false,
	selected,
	onSelectedChange,
	actions,
}: Readonly<{
	change: SyncChange;
	showState?: boolean;
	selected?: boolean;
	onSelectedChange?: (selected: boolean) => void;
	actions?: ReactNode;
}>) {
	const display = parseDisplay(change);
	const title = changeTitle(change, display);
	return (
		<Card className="space-y-3 p-4">
			<div className="flex items-start gap-3">
				{onSelectedChange === undefined ? null : (
					<Checkbox
						checked={selected === true}
						onCheckedChange={(value) => onSelectedChange(value === true)}
						aria-label={`Вибрати зміну: ${title}`}
						className="mt-1"
					/>
				)}
				<div className="min-w-0 flex-1 space-y-3">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="soft">{kindLabel(change.kind)}</Badge>
						{showState ? (
							<Badge
								variant={change.state === "applied" ? "success" : "outline"}
							>
								{stateLabel(change.state)}
							</Badge>
						) : null}
						{change.ratings > 0 ? (
							<Badge variant="secondary">
								<Star />
								{ratingLabel(change.ratings)}
							</Badge>
						) : null}
						{change.never_auto ? (
							<Badge variant="outline">
								<Lock />
								Потрібне підтвердження
							</Badge>
						) : null}
					</div>
					<p className="font-medium break-words">{title}</p>
					<DisplayRows display={display} />
					{change.group === "mapping" ? null : (
						<FieldDiff change={change} display={display} />
					)}
				</div>
			</div>
			{actions}
		</Card>
	);
}

import { useId, useMemo, useState } from "react";

import { ChevronDown, ExternalLink } from "lucide-react";

import type { CourseOffering } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import {
	BASE_CAZ_URL,
	groupByYear,
	loadSignature,
	runsInOneTerm,
	sortOfferings,
	specialitiesLabel,
} from "./CourseCazRecords";
import type { YearGroup } from "./CourseCazRecords";

const VISIBLE_YEARS = 3;

function cazUrl(code: string): string {
	return `${BASE_CAZ_URL}${encodeURIComponent(code)}`;
}

// What a past year adds on top of the header: only the facts that differ.
function yearNote(
	group: YearGroup,
	currentLoad: string,
	showTerm: boolean,
): string {
	const load = loadSignature(group.records[0]);
	return [
		showTerm ? group.terms : null,
		load && load !== currentLoad ? load : null,
	]
		.filter(Boolean)
		.join(", ");
}

function streamsWord(count: number): string {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) {
		return "потік";
	}
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
		return "потоки";
	}
	return "потоків";
}

function YearLine({
	group,
	note,
}: Readonly<{ group: YearGroup; note: string }>) {
	const [open, setOpen] = useState(false);
	const listId = useId();
	const single = group.records.length === 1 ? group.records[0] : null;

	return (
		<li className="py-2">
			<div className="flex items-baseline justify-between gap-3">
				<div className="min-w-0">
					<span className="font-medium tabular-nums">{group.year}</span>
					{note ? (
						<span className="ml-2 text-muted-foreground">{note}</span>
					) : null}
				</div>
				{single?.code ? (
					<a
						href={cazUrl(single.code)}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={`${group.year}, відкрити запис у САЗ`}
						className="inline-flex shrink-0 items-center gap-1 text-muted-foreground transition-colors hover:text-primary"
					>
						САЗ
						<ExternalLink className="size-3" aria-hidden="true" />
					</a>
				) : (
					<button
						type="button"
						aria-expanded={open}
						aria-controls={listId}
						onClick={() => setOpen((value) => !value)}
						className="inline-flex shrink-0 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
					>
						{group.records.length} {streamsWord(group.records.length)}
						<ChevronDown
							className={cn(
								"size-3.5 transition-transform",
								open && "rotate-180",
							)}
							aria-hidden="true"
						/>
					</button>
				)}
			</div>
			{open && !single ? (
				<ul id={listId} className="mt-2 space-y-1.5 border-l pl-3">
					{group.records.map((record) => (
						<li key={record.id ?? record.code}>
							<a
								href={record.code ? cazUrl(record.code) : undefined}
								target="_blank"
								rel="noopener noreferrer"
								className="text-muted-foreground transition-colors hover:text-primary"
							>
								{specialitiesLabel(record) || `код ${record.code}`}
								<ExternalLink
									className="ml-1 inline size-3 align-baseline"
									aria-hidden="true"
								/>
							</a>
						</li>
					))}
				</ul>
			) : null}
		</li>
	);
}

function useHistory(courseOfferings: readonly CourseOffering[]) {
	return useMemo(() => {
		const groups = groupByYear(sortOfferings(courseOfferings));
		const currentLoad = groups[0] ? loadSignature(groups[0].records[0]) : "";
		const showTerm = !runsInOneTerm(courseOfferings);
		return { groups, currentLoad, showTerm };
	}, [courseOfferings]);
}

/** One line per year: the year, what changed since, and the САЗ record. */
export function CourseHistoryRows({
	courseOfferings,
}: Readonly<{ courseOfferings: readonly CourseOffering[] }>) {
	const { groups, currentLoad, showTerm } = useHistory(courseOfferings);
	const [all, setAll] = useState(false);
	if (groups.length === 0) {
		return null;
	}
	const shown = all ? groups : groups.slice(0, VISIBLE_YEARS);
	const rest = groups.length - shown.length;

	return (
		<div className="text-sm">
			<ul className="divide-y divide-border/60">
				{shown.map((group) => (
					<YearLine
						key={group.key}
						group={group}
						note={yearNote(group, currentLoad, showTerm)}
					/>
				))}
			</ul>
			{rest > 0 || all ? (
				<button
					type="button"
					onClick={() => setAll((value) => !value)}
					className="mt-1 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
				>
					{all ? "Згорнути" : `ще ${rest}`}
				</button>
			) : null}
		</div>
	);
}

function yearsWord(count: number): string {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) {
		return "рік";
	}
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
		return "роки";
	}
	return "років";
}

/** The whole history folded into one line until asked for. */
export function CourseHistoryDisclosure({
	courseOfferings,
	defaultOpen = false,
}: Readonly<{
	courseOfferings: readonly CourseOffering[];
	defaultOpen?: boolean;
}>) {
	const { groups } = useHistory(courseOfferings);
	const [open, setOpen] = useState(defaultOpen);
	const panelId = useId();
	if (groups.length === 0) {
		return null;
	}
	const oldest = groups.at(-1)?.year.split("–")[0];

	return (
		<section aria-label="Історія дисципліни" className="rounded-xl border">
			<button
				type="button"
				aria-expanded={open}
				aria-controls={panelId}
				onClick={() => setOpen((value) => !value)}
				className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
			>
				<span>
					<span className="block text-sm font-semibold">
						Історія дисципліни
					</span>
					<span className="block text-xs text-muted-foreground">
						Викладається з {oldest}, {groups.length} {yearsWord(groups.length)}{" "}
						у САЗ
					</span>
				</span>
				<ChevronDown
					className={cn(
						"size-4 shrink-0 text-muted-foreground transition-transform",
						open && "rotate-180",
					)}
					aria-hidden="true"
				/>
			</button>
			{open ? (
				<div id={panelId} className="border-t px-4 pb-2 pt-1">
					<CourseHistoryRows courseOfferings={courseOfferings} />
				</div>
			) : null}
		</section>
	);
}

/** Years as small links in one wrapping row; split years expand underneath. */
export function CourseHistoryChips({
	courseOfferings,
}: Readonly<{ courseOfferings: readonly CourseOffering[] }>) {
	const { groups, currentLoad, showTerm } = useHistory(courseOfferings);
	const [openKey, setOpenKey] = useState<string | null>(null);
	if (groups.length === 0) {
		return null;
	}
	const openGroup = groups.find((group) => group.key === openKey);
	const chip =
		"inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums transition-colors hover:bg-muted/70 hover:text-primary";

	return (
		<div className="space-y-2 text-sm">
			<div className="flex flex-wrap gap-1.5">
				{groups.map((group) => {
					const note = yearNote(group, currentLoad, showTerm);
					const label = `${group.year}${note ? `, ${note}` : ""}`;
					const single = group.records.length === 1 ? group.records[0] : null;
					return single?.code ? (
						<a
							key={group.key}
							href={cazUrl(single.code)}
							target="_blank"
							rel="noopener noreferrer"
							className={chip}
						>
							{label}
							<ExternalLink className="size-3" aria-hidden="true" />
						</a>
					) : (
						<button
							key={group.key}
							type="button"
							aria-expanded={openKey === group.key}
							onClick={() =>
								setOpenKey((key) => (key === group.key ? null : group.key))
							}
							className={cn(chip, openKey === group.key && "bg-primary/10")}
						>
							{label}
							<span className="text-muted-foreground">
								{group.records.length}
							</span>
							<ChevronDown
								className={cn(
									"size-3 transition-transform",
									openKey === group.key && "rotate-180",
								)}
								aria-hidden="true"
							/>
						</button>
					);
				})}
			</div>
			{openGroup ? (
				<ul className="space-y-1.5 border-l pl-3">
					{openGroup.records.map((record) => (
						<li key={record.id ?? record.code}>
							<a
								href={record.code ? cazUrl(record.code) : undefined}
								target="_blank"
								rel="noopener noreferrer"
								className="text-muted-foreground transition-colors hover:text-primary"
							>
								{specialitiesLabel(record) || `код ${record.code}`}
								<ExternalLink
									className="ml-1 inline size-3 align-baseline"
									aria-hidden="true"
								/>
							</a>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}

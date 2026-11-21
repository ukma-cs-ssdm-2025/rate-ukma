import { useId, useMemo, useState } from "react";

import { ChevronDown, ExternalLink } from "lucide-react";

import { TermBadge } from "@/components/TermBadge";
import {
	getAcademicStartYear,
	parseSemesterTerm,
} from "@/features/courses/courseFormatting";
import { getSpecialityAlias } from "@/features/courses/components/CourseSpecialityBadges";
import type {
	CourseOffering,
	CourseOfferingSpeciality,
	SemesterTermEnum,
} from "@/lib/api/generated";
import { getFacultyColors } from "@/lib/faculty-colors";
import { cn } from "@/lib/utils";
import { BASE_CAZ_URL, sortOfferings } from "./CourseCazRecords";

const VISIBLE_YEARS = 3;
const TERM_ORDER: readonly SemesterTermEnum[] = ["FALL", "SPRING", "SUMMER"];

function cazUrl(code: string): string {
	return `${BASE_CAZ_URL}${encodeURIComponent(code)}`;
}

// Every row, year or record, has the same four columns, so the eye reads
// down them instead of parsing a sentence per row.
const COLUMNS =
	"grid grid-cols-[4.25rem_minmax(0,1fr)_3rem_2.25rem] items-center gap-x-2";

function seasons(records: readonly CourseOffering[]): SemesterTermEnum[] {
	const found = new Set(
		records.flatMap((record) =>
			(record.terms.length > 0
				? record.terms.map((term) => term.semester_term)
				: [record.semester_term]
			).map((term) => parseSemesterTerm(term)),
		),
	);
	return TERM_ORDER.filter((term) => found.has(term));
}

function formatNumber(value: number): string {
	return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function recordsWord(count: number): string {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) {
		return "запис";
	}
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
		return "записи";
	}
	return "записів";
}

function credits(records: readonly CourseOffering[]): string {
	const values = [
		...new Set(
			records.flatMap((record) =>
				record.terms.flatMap((term) =>
					term.credits ? [Number.parseFloat(term.credits)] : [],
				),
			),
		),
	].sort((a, b) => a - b);
	if (values.length === 0) {
		return "";
	}
	const low = values[0];
	const high = values.at(-1) ?? low;
	return low === high
		? formatNumber(low)
		: `${formatNumber(low)}–${formatNumber(high)}`;
}

function facultyOrder(speciality: CourseOfferingSpeciality | undefined) {
	return `${speciality?.faculty_name ?? ""}|${speciality?.speciality_title ?? ""}`;
}

function sortedSpecialities(record: CourseOffering) {
	return [...record.specialities].sort((a, b) =>
		facultyOrder(a).localeCompare(facultyOrder(b), "uk"),
	);
}

interface Year {
	label: string;
	records: CourseOffering[];
}

// One row per academic year, however many САЗ records it holds.
function groupYears(offerings: readonly CourseOffering[]): Year[] {
	const years = new Map<string, CourseOffering[]>();
	for (const record of sortOfferings(offerings)) {
		const start = getAcademicStartYear(
			record.semester_year,
			record.semester_term,
		);
		const label =
			start === null ? "—" : `${start}–${String(start + 1).slice(-2)}`;
		years.set(label, [...(years.get(label) ?? []), record]);
	}
	return [...years].map(([label, records]) => ({
		label,
		records: records.sort((a, b) =>
			facultyOrder(sortedSpecialities(a)[0]).localeCompare(
				facultyOrder(sortedSpecialities(b)[0]),
				"uk",
			),
		),
	}));
}

const pill =
	"inline-flex max-w-full items-center rounded-md px-1.5 py-px text-xs font-medium";
const MAX_ALIASES = 4;
const LONG_TITLE = 32;

// САЗ titles run up to «Філологія (германські мови та літератури (переклад
// включно))»; past a line the curated alias reads better.
function fullName(speciality: CourseOfferingSpeciality): string {
	const title = speciality.speciality_title ?? "";
	return title.length > LONG_TITLE && speciality.speciality_alias
		? speciality.speciality_alias
		: title;
}

function SpecialityPills({
	specialities,
}: Readonly<{ specialities: readonly CourseOfferingSpeciality[] }>) {
	// One speciality reads in full; a list falls back to the header's aliases.
	const full = specialities.length === 1;
	const shown = full ? specialities : specialities.slice(0, MAX_ALIASES);
	const hidden = specialities.length - shown.length;
	return (
		<span className="flex min-w-0 flex-wrap items-center gap-1">
			{shown.map((speciality) => {
				const colors = getFacultyColors(speciality.faculty_name || "");
				return (
					<span
						key={speciality.speciality_id}
						title={speciality.speciality_title ?? undefined}
						className={cn(pill, colors.bg, colors.text)}
					>
						{full
							? fullName(speciality)
							: getSpecialityAlias(
									speciality.speciality_title || "",
									speciality.speciality_alias,
								)}
					</span>
				);
			})}
			{hidden > 0 ? (
				<span
					className="text-xs text-muted-foreground"
					title={specialities
						.slice(MAX_ALIASES)
						.map((speciality) => speciality.speciality_title)
						.join(", ")}
				>
					+{hidden}
				</span>
			) : null}
		</span>
	);
}

function Terms({ records }: Readonly<{ records: readonly CourseOffering[] }>) {
	return (
		<span className="flex gap-1">
			{seasons(records).map((term) => (
				<TermBadge key={term} term={term} className="px-1.5 py-px" />
			))}
		</span>
	);
}

function CazLink({ code, label }: Readonly<{ code?: string; label: string }>) {
	if (!code) {
		return <span />;
	}
	return (
		<a
			href={cazUrl(code)}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={`${label}, відкрити запис у САЗ`}
			title="Запис у САЗ"
			className="-my-1 inline-flex justify-self-end rounded-sm p-1 text-muted-foreground transition-colors hover:text-primary"
		>
			<ExternalLink className="size-3.5" aria-hidden="true" />
		</a>
	);
}

function YearRow({ year }: Readonly<{ year: Year }>) {
	const [open, setOpen] = useState(false);
	const listId = useId();
	const single = year.records.length === 1 ? year.records[0] : null;

	return (
		<li className="py-2">
			<div className={COLUMNS}>
				<span className="font-medium tabular-nums">{year.label}</span>
				<Terms records={year.records} />
				<span className="text-right tabular-nums text-muted-foreground">
					{credits(year.records)}
				</span>
				{single ? (
					<CazLink code={single.code} label={year.label} />
				) : (
					<button
						type="button"
						aria-expanded={open}
						aria-controls={listId}
						aria-label={`${year.label}: ${year.records.length} ${recordsWord(year.records.length)} у САЗ`}
						onClick={() => setOpen((value) => !value)}
						className="-my-1 inline-flex items-center justify-self-end gap-0.5 rounded-sm p-1 text-xs tabular-nums text-muted-foreground transition-colors hover:text-foreground"
					>
						{year.records.length}
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
				<ul
					id={listId}
					className="-mx-2 mt-2 space-y-2.5 rounded-lg bg-muted/50 px-2 py-2.5"
				>
					{year.records.map((record) => (
						<li key={record.id ?? record.code} className="space-y-1">
							<SpecialityPills specialities={sortedSpecialities(record)} />
							<div className={cn(COLUMNS, "text-xs")}>
								<span className="text-muted-foreground">
									{record.study_year ? `${record.study_year} курс` : ""}
								</span>
								<Terms records={[record]} />
								<span className="text-right tabular-nums text-muted-foreground">
									{credits([record])}
								</span>
								<CazLink
									code={record.code}
									label={`${year.label}, ${record.study_year ?? ""} курс`}
								/>
							</div>
						</li>
					))}
				</ul>
			) : null}
		</li>
	);
}

/** One line per year: the year, its terms, its credits and the САЗ record. */
export function CourseHistoryRows({
	courseOfferings,
}: Readonly<{ courseOfferings: readonly CourseOffering[] }>) {
	const years = useMemo(() => groupYears(courseOfferings), [courseOfferings]);
	const [all, setAll] = useState(false);
	if (years.length === 0) {
		return null;
	}
	const shown = all ? years : years.slice(0, VISIBLE_YEARS);
	const rest = years.length - shown.length;

	return (
		<div className="text-sm">
			<div
				className={cn(COLUMNS, "pb-1 text-xs text-muted-foreground")}
				aria-hidden="true"
			>
				<span>Рік</span>
				<span>Семестр</span>
				<span className="text-right">ECTS</span>
				<span />
			</div>
			<ul className="divide-y divide-border/60">
				{shown.map((year) => (
					<YearRow key={year.label} year={year} />
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

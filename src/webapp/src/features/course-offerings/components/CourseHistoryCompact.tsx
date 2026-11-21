import { useId, useMemo, useState } from "react";

import { ChevronDown, ExternalLink } from "lucide-react";

import {
	formatAcademicYearLabel,
	getSemesterTermDisplay,
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
import { BASE_CAZ_URL, loadSignature, sortOfferings } from "./CourseCazRecords";

const VISIBLE_YEARS = 3;
const TERM_ORDER: readonly SemesterTermEnum[] = ["FALL", "SPRING", "SUMMER"];

function cazUrl(code: string): string {
	return `${BASE_CAZ_URL}${encodeURIComponent(code)}`;
}

function plural(count: number, one: string, few: string, many: string) {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) {
		return one;
	}
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
		return few;
	}
	return many;
}

// The facts a САЗ record can differ in, in reading order.
const FACTS = ["terms", "course", "load"] as const;
type Fact = (typeof FACTS)[number];

interface Run {
	record: CourseOffering;
	specialities: CourseOfferingSpeciality[];
	facts: Record<Fact, string>;
	specialityKey: string;
}

function termsLabel(record: CourseOffering): string {
	const raw =
		record.terms.length > 0
			? record.terms.map((term) => term.semester_term)
			: [record.semester_term];
	const seasons = new Set(raw.map((term) => parseSemesterTerm(term)));
	return TERM_ORDER.flatMap((term) =>
		seasons.has(term) ? [getSemesterTermDisplay(term)] : [],
	).join(", ");
}

function facultyOrder(speciality: CourseOfferingSpeciality | undefined) {
	return `${speciality?.faculty_name ?? ""}|${speciality?.speciality_title ?? ""}`;
}

function toRun(record: CourseOffering): Run {
	const specialities = [...record.specialities].sort((a, b) =>
		facultyOrder(a).localeCompare(facultyOrder(b), "uk"),
	);
	return {
		record,
		specialities,
		facts: {
			terms: termsLabel(record),
			course: record.study_year ? `${record.study_year} курс` : "",
			load: loadSignature(record),
		},
		specialityKey: specialities
			.map((speciality) => speciality.speciality_id)
			.join(","),
	};
}

interface Year {
	label: string;
	runs: Run[];
}

// One row per academic year, however many САЗ records it holds.
function groupYears(offerings: readonly CourseOffering[]): Year[] {
	const years = new Map<string, Run[]>();
	for (const record of sortOfferings(offerings)) {
		const label = formatAcademicYearLabel(
			record.semester_year,
			record.semester_term,
		);
		years.set(label, [...(years.get(label) ?? []), toRun(record)]);
	}
	return [...years].map(([label, runs]) => ({
		label,
		runs: runs.sort((a, b) =>
			facultyOrder(a.specialities[0]).localeCompare(
				facultyOrder(b.specialities[0]),
				"uk",
			),
		),
	}));
}

/** The value every record of the year shares, or null when they differ. */
function shared(year: Year, fact: Fact): string | null {
	const values = new Set(year.runs.map((run) => run.facts[fact]));
	return values.size === 1 ? [...values][0] : null;
}

// What a past year says on its collapsed row: only what it shares across its
// records and what differs from the current run in the header.
function yearNote(year: Year, current: Year): string[] {
	if (year === current) {
		return [];
	}
	return FACTS.flatMap((fact) => {
		const value = shared(year, fact);
		return value && value !== shared(current, fact) ? [value] : [];
	});
}

function splitSummary(year: Year): string {
	const { runs } = year;
	const bySpeciality = new Set(runs.map((run) => run.specialityKey)).size > 1;
	const oneEach = runs.every((run) => run.specialities.length === 1);
	if (bySpeciality && oneEach) {
		return `${runs.length} ${plural(runs.length, "спеціальність", "спеціальності", "спеціальностей")}`;
	}
	// Same students' programme in different years of study: the курс says it.
	if (!bySpeciality && shared(year, "course") === null) {
		const courses = runs.map((run) => run.record.study_year ?? 0);
		const unique = [...new Set(courses)].sort((a, b) => a - b);
		return `${unique.slice(0, -1).join(", ")} і ${unique.at(-1)} курс`;
	}
	return `${runs.length} ${plural(runs.length, "запис", "записи", "записів")}`;
}

const pill =
	"inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-xs font-medium";
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
		<>
			{shown.map((speciality) => {
				const colors = getFacultyColors(speciality.faculty_name || "");
				return (
					<span
						key={speciality.speciality_id}
						title={
							full ? undefined : (speciality.speciality_title ?? undefined)
						}
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
		</>
	);
}

function CazLink({
	code,
	label,
	children,
	className,
}: Readonly<{
	code?: string;
	label: string;
	children?: React.ReactNode;
	className?: string;
}>) {
	if (!code) {
		return null;
	}
	return (
		<a
			href={cazUrl(code)}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={`${label}, відкрити запис у САЗ`}
			className={cn(
				"inline-flex shrink-0 items-center gap-1 text-muted-foreground transition-colors hover:text-primary",
				className,
			)}
		>
			{children}
			<ExternalLink className="size-3" aria-hidden="true" />
		</a>
	);
}

function YearRow({ year, current }: Readonly<{ year: Year; current: Year }>) {
	const [open, setOpen] = useState(false);
	const listId = useId();
	const single = year.runs.length === 1 ? year.runs[0] : null;
	const note = yearNote(year, current);
	const varying = FACTS.filter((fact) => shared(year, fact) === null);

	return (
		<li className="py-2">
			<div className="flex items-baseline justify-between gap-3">
				{/* The note drops under the year as a whole rather than splitting. */}
				<div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
					<span className="font-medium tabular-nums">{year.label}</span>
					{note.length > 0 ? (
						<span className="whitespace-nowrap text-muted-foreground">
							{note.join(", ")}
						</span>
					) : null}
				</div>
				{single ? (
					<CazLink code={single.record.code} label={year.label}>
						САЗ
					</CazLink>
				) : (
					<button
						type="button"
						aria-expanded={open}
						aria-controls={listId}
						onClick={() => setOpen((value) => !value)}
						className="inline-flex shrink-0 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
					>
						{splitSummary(year)}
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
				<ul id={listId} className="mt-2 space-y-2">
					{year.runs.map((run) => {
						const facts = varying.flatMap((fact) =>
							run.facts[fact] ? [run.facts[fact]] : [],
						);
						return (
							<li key={run.record.id ?? run.record.code}>
								<div className="flex items-start justify-between gap-3">
									<div className="flex min-w-0 flex-wrap items-center gap-1.5">
										<SpecialityPills specialities={run.specialities} />
									</div>
									<CazLink
										code={run.record.code}
										label={[year.label, ...facts].join(", ")}
										className="mt-1"
									/>
								</div>
								{facts.length > 0 ? (
									<p className="mt-0.5 text-xs text-muted-foreground">
										{facts.join(", ")}
									</p>
								) : null}
							</li>
						);
					})}
				</ul>
			) : null}
		</li>
	);
}

/** One line per year: the year, what changed since, and the САЗ record. */
export function CourseHistoryRows({
	courseOfferings,
}: Readonly<{ courseOfferings: readonly CourseOffering[] }>) {
	const years = useMemo(() => groupYears(courseOfferings), [courseOfferings]);
	const [all, setAll] = useState(false);
	const current = years[0];
	if (!current) {
		return null;
	}
	const shown = all ? years : years.slice(0, VISIBLE_YEARS);
	const rest = years.length - shown.length;

	return (
		<div className="text-sm">
			<ul className="divide-y divide-border/60">
				{shown.map((year) => (
					<YearRow key={year.label} year={year} current={current} />
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

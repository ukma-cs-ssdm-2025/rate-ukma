import type { LessonRow, Offering, Selection } from "@/features/schedule/core";
import {
	diffRows,
	resolveVariants,
	rowsOfPlan,
} from "@/features/schedule/core";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Label } from "@/components/ui/Label";
import { Skeleton } from "@/components/ui/Skeleton";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
import {
	fetchVersionRows,
	fetchVersions,
	type ScheduleVersion,
} from "@/features/schedule/lib/api";
import {
	CHANGE_MARK,
	changesAsText,
	describeChanges,
	groupChanges,
	type ChangeLine,
} from "@/features/schedule/core";
import type { Semester } from "@/features/schedule/lib/data";
import { queryKeys } from "@/features/schedule/lib/query";
import {
	copyTextSilent,
	toastCopyFailed,
} from "@/features/schedule/lib/clipboard";

interface Props {
	semester: Semester;
	names: ReadonlyMap<string, string>;
	pickedOfferings: ReadonlyArray<Offering>;
	selection: Selection;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

const KIND = {
	added: { title: "додано", tone: "text-success" },
	removed: { title: "зникло", tone: "text-destructive" },
	changed: { title: "змінено", tone: "text-warning" },
	moved: { title: "перенесено", tone: "text-primary" },
} as const;

const useVersionRows = (id: number | undefined, open: boolean) =>
	useQuery({
		queryKey: queryKeys.versionRows(id ?? 0),
		queryFn: () => fetchVersionRows(id ?? 0),
		enabled: open && id !== undefined,
		// A missing reading is a fact, not a flake: fail fast and say so.
		retry: 1,
	});

/** The change list while it is on its way, shaped like `ChangesList`: the
 *  dialog is centred, so any height it gains on arrival moves it. */
const Pending = ({ label }: { label: string }) => (
	<div
		className="flex flex-col gap-3"
		role="status"
		aria-busy
		data-testid="versions-pending"
	>
		<span className="sr-only">{label}</span>
		<section>
			<Skeleton className="mb-1 h-5 w-48" />
			<div className="flex flex-col gap-1">
				<Skeleton className="h-7 w-full" />
				<Skeleton className="h-7 w-full" />
				<Skeleton className="h-7 w-full" />
			</div>
		</section>
	</div>
);

/** `CompareControls` and the list below it, while the readings are listed. */
const PendingControls = ({ label }: { label: string }) => (
	<div className="flex flex-col gap-3">
		<Skeleton className="h-7 w-72 max-w-full" aria-hidden />
		<Skeleton className="h-4 w-44" aria-hidden />
		<Pending label={label} />
	</div>
);

const Failed = ({ label, retry }: { label: string; retry: () => void }) => (
	<div
		className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs"
		role="alert"
		data-testid="versions-failed"
	>
		<span className="text-destructive">{label}</span>
		<Button variant="outline" size="xs" onClick={retry}>
			Спробувати ще раз
		</Button>
	</div>
);

const versionLabel = (version: ScheduleVersion): string =>
	new Date(version.at).toLocaleString("uk", {
		day: "2-digit",
		month: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});

/**
 * Every time САЗ republished a file the server kept what it read. This is the
 * one place to look back: pick an earlier reading and see, as text, what moved
 * since — in the whole semester or only in the disciplines of the plan.
 */
export function ScheduleVersions(props: Props) {
	const { semester, names, pickedOfferings, selection, open, onOpenChange } =
		props;
	const [baseId, setBaseId] = useState<number>();
	const [mineOnly, setMineOnly] = useState(true);
	const [copied, setCopied] = useState(false);

	const versions = useQuery({
		queryKey: queryKeys.versions(semester.name),
		queryFn: () => fetchVersions(semester.name),
		enabled: open,
	});
	const list = versions.data ?? [];
	const latest = list[0];
	// Readings worth comparing with: those after which something moved. With
	// «Тільки мої дисципліни» on, "something" is a row of a discipline in the
	// plan; off, any row at all. A reading that changed other faculties' sheets
	// would show an empty diff, and the student would click through it for nothing.
	const picked = pickedOfferings.map((offering) => offering.disciplineId);
	const pickedSet = new Set<string>(picked);
	const moved = (version: ScheduleVersion): boolean =>
		mineOnly && picked.length > 0
			? (version.disciplinesChanged ?? []).some((id) => pickedSet.has(id))
			: version.rowsAdded + version.rowsRemoved > 0;
	const earlier = list.slice(1);
	const options = earlier.filter((candidate) =>
		list.some((version) => version.id > candidate.id && moved(version)),
	);
	// The nearest reading that matters is the default comparison; the first
	// ingest of a semester has nothing to compare to.
	const base = list.find((v) => v.id === baseId) ?? options[0];

	const latestRows = useVersionRows(latest?.id, open);
	const baseRows = useVersionRows(base?.id, open);

	const labels = new Map(
		semester.files.map((file) => [file.source, file.label]),
	);
	const resolve = (rows: ReadonlyArray<LessonRow>) =>
		resolveVariants(rows, (source) => labels.get(source) ?? source);
	const narrow = (rows: ReadonlyArray<LessonRow>) =>
		mineOnly && picked.length > 0 ? rowsOfPlan(rows, picked, selection) : rows;

	const lines: ReadonlyArray<ChangeLine> | undefined =
		baseRows.data && latestRows.data
			? describeChanges(
					diffRows(
						narrow(resolve(baseRows.data)),
						narrow(resolve(latestRows.data)),
					),
					names,
					semester.weekDates,
				)
			: undefined;

	// Every file some reading after the base one saw republished.
	const changedSince = changedFilesSince(list, base);
	const copy = async () => {
		if (!lines) return;
		const ok = await copyTextSilent(changesAsText(lines));
		if (!ok) toastCopyFailed();
		if (ok) {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-2xl md:top-24 md:translate-y-0"
				data-testid="versions-dialog"
			>
				<DialogHeader>
					<DialogTitle>Що змінилося в розкладі</DialogTitle>
					<DialogDescription className="sr-only">
						Порівняння двох читань опублікованого розкладу.
					</DialogDescription>
				</DialogHeader>

				{versions.isPending && (
					<PendingControls label="Шукаємо читання розкладу…" />
				)}
				{versions.isError && (
					<Failed
						label="Не вдалося завантажити список читань."
						retry={() => void versions.refetch()}
					/>
				)}
				{versions.isSuccess && list.length === 0 && (
					<p
						className="text-xs text-muted-foreground"
						data-testid="versions-single"
					>
						Читань цього семестру ще не збережено.
					</p>
				)}
				{list.length > 0 && latest && (
					<div className="flex flex-col gap-3">
						<CompareControls
							base={base}
							options={options}
							latest={latest}
							singleReading={options.length === 0}
							setBaseId={setBaseId}
							mineOnly={mineOnly}
							setMineOnly={setMineOnly}
							hasPlan={picked.length > 0}
							lines={lines}
							copied={copied}
							copy={copy}
						/>
						{base === undefined ? (
							<p
								className="text-xs text-muted-foreground"
								data-testid="versions-single"
							>
								Поки що одне читання, немає з чим порівняти.
							</p>
						) : baseRows.isError || latestRows.isError ? (
							<Failed
								label="Не вдалося завантажити одне з читань."
								retry={() => {
									void baseRows.refetch();
									void latestRows.refetch();
								}}
							/>
						) : lines === undefined ? (
							<Pending label="Порівнюємо два читання…" />
						) : lines.length === 0 ? (
							<p
								className="text-xs text-muted-foreground"
								data-testid="versions-same"
							>
								{mineOnly && picked.length > 0
									? "У твоїх дисциплінах без змін."
									: "Без змін у цих читаннях."}
							</p>
						) : (
							<ChangesList lines={lines} />
						)}

						{changedSince.length > 0 && (
							<p className="text-meta text-muted-foreground">
								Змінилися файли:{" "}
								{changedSince
									.map((source) => labels.get(source) ?? source)
									.join(", ")}
							</p>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

/** Every file some reading after the base one saw republished, first-seen first. */
const changedFilesSince = (
	list: ReadonlyArray<ScheduleVersion>,
	base: ScheduleVersion | undefined,
): ReadonlyArray<string> => {
	if (base === undefined) return [];
	const changed: string[] = [];
	const seen = new Set<string>();
	for (const version of list) {
		if (version.id <= base.id) continue;
		for (const source of version.filesChanged) {
			if (seen.has(source)) continue;
			seen.add(source);
			changed.push(source);
		}
	}
	return changed;
};

/** Which reading the current one is compared against, whose disciplines count,
 *  and the copy action — the controls above the change list. */
function CompareControls(props: {
	base: ScheduleVersion | undefined;
	options: ReadonlyArray<ScheduleVersion>;
	latest: ScheduleVersion;
	singleReading: boolean;
	setBaseId: (id: number) => void;
	mineOnly: boolean;
	setMineOnly: (value: boolean) => void;
	hasPlan: boolean;
	lines: ReadonlyArray<ChangeLine> | undefined;
	copied: boolean;
	copy: () => Promise<void>;
}) {
	const {
		base,
		options,
		latest,
		singleReading,
		setBaseId,
		mineOnly,
		setMineOnly,
		hasPlan,
		lines,
		copied,
		copy,
	} = props;
	return (
		<>
			<div className="flex flex-wrap items-center gap-2 text-xs">
				<span className="text-muted-foreground">Порівняти</span>
				<Select
					value={base ? String(base.id) : undefined}
					onValueChange={(value) => setBaseId(Number(value))}
					disabled={singleReading}
				>
					<SelectTrigger
						size="sm"
						className="h-7 text-xs"
						data-testid="versions-base"
						aria-label="Попереднє читання"
					>
						<SelectValue placeholder="попереднього читання ще немає" />
					</SelectTrigger>
					<SelectContent>
						{options.map((version) => (
							<SelectItem key={version.id} value={String(version.id)}>
								{versionLabel(version)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<span className="text-muted-foreground">
					з поточним: {versionLabel(latest)}
				</span>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Checkbox
						id="versions-mine"
						checked={mineOnly}
						onCheckedChange={(checked) => setMineOnly(checked === true)}
						data-testid="versions-mine"
						disabled={!hasPlan}
					/>
					<Label
						htmlFor="versions-mine"
						className="text-xs font-normal text-muted-foreground"
					>
						Тільки мої дисципліни
					</Label>
				</div>
				{lines && lines.length > 0 && (
					<Button
						variant="ghost"
						size="xs"
						data-testid="versions-copy"
						onClick={() => void copy()}
						className="text-muted-foreground"
					>
						{copied ? (
							<>
								<Check /> Скопійовано
							</>
						) : (
							<>
								<Copy /> Скопіювати список
							</>
						)}
					</Button>
				)}
			</div>
		</>
	);
}

/** The grouped change lines between two readings, scrolled. */
function ChangesList(props: { lines: ReadonlyArray<ChangeLine> }) {
	return (
		<div
			className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto text-xs"
			data-testid="versions-changes"
		>
			{groupChanges(props.lines).map((group) => (
				<section key={group.disciplineId}>
					<h3 className="mb-1 text-sm font-medium text-foreground">
						{group.discipline}
					</h3>
					<ul className="flex flex-col gap-1">
						{group.lines.map((line) => (
							<ChangeRow key={line.key} line={line} />
						))}
					</ul>
				</section>
			))}
		</div>
	);
}

/** One change line: what moved, with the before → after detail. */
function ChangeRow(props: { line: ChangeLine }) {
	const { line } = props;
	return (
		<li
			data-testid="change-line"
			data-kind={line.kind}
			className="flex gap-2 rounded-md bg-muted/40 px-2 py-1.5"
		>
			<span
				className={`w-3 shrink-0 text-center font-mono ${KIND[line.kind].tone}`}
				title={KIND[line.kind].title}
			>
				{CHANGE_MARK[line.kind]}
			</span>
			<span className="min-w-0 flex-1">
				{line.kind === "moved" ? (
					<>
						<span className="font-medium text-foreground">{line.lesson}</span>
						<span className="text-muted-foreground">
							{": "}
							<s className="decoration-muted-foreground/60">
								{line.changes[0]?.was}
							</s>
							{" → "}
							<span className="text-foreground">{line.changes[0]?.now}</span>
							{`, ${line.detail}`}
						</span>
					</>
				) : (
					<>
						<span className="font-medium text-foreground">{line.lesson}</span>
						<span className="text-muted-foreground">, {line.when}</span>
						{line.kind === "changed" ? (
							<span className="mt-0.5 flex flex-wrap gap-x-3 text-muted-foreground">
								{line.changes.map((change) => (
									<span key={change.label}>
										{change.label}{" "}
										<s className="decoration-muted-foreground/60">
											{change.was}
										</s>
										{" → "}
										<span className="font-medium text-foreground">
											{change.now}
										</span>
									</span>
								))}
							</span>
						) : (
							<span
								className={`block ${line.kind === "removed" ? "text-muted-foreground line-through decoration-muted-foreground/60" : "text-foreground"}`}
							>
								{line.detail}
							</span>
						)}
					</>
				)}
			</span>
		</li>
	);
}

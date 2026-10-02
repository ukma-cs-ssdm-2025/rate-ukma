import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/utils";
import { useCourseAverages } from "./CourseContext";
import type { QueueItem, RateQueue, Scores } from "./useRateQueue";

const AXIS = [1, 2, 3, 4, 5] as const;
const ROWS = [5, 4, 3, 2, 1] as const;

type Placement = Record<string, Scores>;

function Marker({
	number,
	selected = false,
	ghost = false,
}: Readonly<{ number: number; selected?: boolean; ghost?: boolean }>) {
	return (
		<span
			className={cn(
				"flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
				ghost
					? "border-2 border-dashed border-foreground/50 bg-background/80 text-foreground/70"
					: "bg-primary text-primary-foreground shadow-sm",
				selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
			)}
		>
			{number}
		</span>
	);
}

/** Others' average for one course, as a dashed ring at its exact spot. */
function GhostMarker({
	item,
	number,
}: Readonly<{ item: QueueItem; number: number }>) {
	const { difficulty, usefulness } = useCourseAverages(item.courseId);
	if (difficulty == null || usefulness == null) return null;
	return (
		<span
			className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
			style={{
				left: `${((difficulty - 0.5) / 5) * 100}%`,
				top: `${((5.5 - usefulness) / 5) * 100}%`,
			}}
		>
			<Marker number={number} ghost />
		</span>
	);
}

/** Variant C: place each course of a semester on the difficulty × usefulness map. */
export function MapVariant({ queue }: Readonly<{ queue: RateQueue }>) {
	const [semesterKey, setSemesterKey] = useState(
		() => queue.semesters[0]?.key ?? "",
	);
	const semester =
		queue.semesters.find((bucket) => bucket.key === semesterKey) ??
		queue.semesters[0];
	const [placed, setPlaced] = useState<Placement>({});
	const [selected, setSelected] = useState<string | null>(
		() => semester?.items[0]?.offeringId ?? null,
	);
	const [compare, setCompare] = useState(false);

	if (!semester) return null;
	const items = semester.items.filter(
		(item) => queue.stateOf(item).kind === "todo",
	);
	const numberOf = (item: QueueItem) => semester.items.indexOf(item) + 1;
	const placedItems = items.filter((item) => placed[item.offeringId]);

	const place = (difficulty: number, usefulness: number) => {
		if (!selected) return;
		setPlaced((prev) => ({ ...prev, [selected]: { difficulty, usefulness } }));
		const next = items.find(
			(item) => item.offeringId !== selected && !placed[item.offeringId],
		);
		setSelected(next?.offeringId ?? null);
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap gap-2" role="tablist" aria-label="Семестр">
				{queue.semesters.map((bucket) => (
					<button
						key={bucket.key}
						type="button"
						role="tab"
						aria-selected={bucket.key === semester.key}
						onClick={() => {
							setSemesterKey(bucket.key);
							setSelected(bucket.items[0]?.offeringId ?? null);
						}}
						className={cn(
							"rounded-full border px-3 py-1 text-sm",
							bucket.key === semester.key &&
								"border-primary bg-primary/10 font-medium",
						)}
					>
						{bucket.label}
						<span className="ml-1.5 text-muted-foreground tabular-nums">
							{bucket.items.length}
						</span>
					</button>
				))}
			</div>

			<div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,640px)_340px] lg:gap-10">
				<div className="order-2 lg:order-1">
					<div className="flex gap-2">
						<div className="flex w-5 items-center justify-center">
							<span className="-rotate-90 whitespace-nowrap text-xs text-muted-foreground">
								Корисність
							</span>
						</div>
						<div className="max-w-[600px] flex-1">
							<div className="relative grid grid-cols-5 overflow-hidden rounded-xl border">
								{ROWS.map((usefulness) =>
									AXIS.map((difficulty) => {
										const here = items.filter(
											(item) =>
												placed[item.offeringId]?.difficulty === difficulty &&
												placed[item.offeringId]?.usefulness === usefulness,
										);
										return (
											<button
												key={`${difficulty}-${usefulness}`}
												type="button"
												aria-label={`Складність ${difficulty}, корисність ${usefulness}`}
												onClick={() => place(difficulty, usefulness)}
												className={cn(
													"flex aspect-square flex-wrap content-center items-center justify-center gap-1 border-r border-b p-1 transition-colors last:border-r-0 sm:aspect-[4/3]",
													difficulty === 5 && "border-r-0",
													usefulness === 1 && "border-b-0",
													selected && "hover:bg-primary/10",
													usefulness >= 4 && difficulty <= 2 && "bg-primary/5",
												)}
											>
												{here.map((item) => (
													<Marker
														key={item.offeringId}
														number={numberOf(item)}
													/>
												))}
											</button>
										);
									}),
								)}
								{compare
									? placedItems.map((item) => (
											<GhostMarker
												key={item.offeringId}
												item={item}
												number={numberOf(item)}
											/>
										))
									: null}
							</div>
							<div className="mt-1 grid max-w-[600px] grid-cols-5 text-center text-xs text-muted-foreground tabular-nums">
								{AXIS.map((value) => (
									<span key={value}>{value}</span>
								))}
							</div>
							<p className="text-center text-xs text-muted-foreground">
								Складність
							</p>
						</div>
					</div>
				</div>

				<aside className="order-1 space-y-4 lg:order-2">
					<p className="text-sm text-muted-foreground">
						Обери курс і торкнись клітинки на карті
					</p>
					<ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
						{items.map((item) => {
							const scores = placed[item.offeringId];
							const isSelected = selected === item.offeringId;
							return (
								<li key={item.offeringId} className="shrink-0">
									<button
										type="button"
										onClick={() => setSelected(item.offeringId)}
										aria-pressed={isSelected}
										className={cn(
											"flex w-56 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm lg:w-full",
											isSelected && "border-primary bg-primary/5",
										)}
									>
										<Marker number={numberOf(item)} selected={isSelected} />
										<span className="min-w-0 flex-1 truncate">{item.title}</span>
										<span className="text-xs tabular-nums text-muted-foreground">
											{scores ? `${scores.difficulty}/${scores.usefulness}` : "—"}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
					<label className="flex items-center gap-2 text-sm">
						<Checkbox
							checked={compare}
							disabled={placedItems.length === 0}
							onCheckedChange={(next) => setCompare(next === true)}
						/>
						Показати, як оцінили інші
					</label>
					<Button
						className="w-full"
						disabled={placedItems.length === 0 || queue.isSaving}
						onClick={async () => {
							for (const item of placedItems) {
								await queue.save(item, placed[item.offeringId]);
							}
							setPlaced({});
						}}
					>
						Зберегти {placedItems.length} з {items.length}
					</Button>
				</aside>
			</div>
		</div>
	);
}

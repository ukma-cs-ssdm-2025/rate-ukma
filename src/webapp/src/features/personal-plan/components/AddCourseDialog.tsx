import { useState } from "react";

import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatAcademicYearLabel } from "@/features/courses/courseFormatting";
import { useAuth } from "@/lib/auth";
import { testIds } from "@/lib/test-ids";
import {
	CATALOG_PAGE_SIZE,
	type CatalogFilters as Filters,
	defaultCatalogFilters,
	useCatalogCourses,
} from "../hooks/useCatalogCourses";
import { getSemesterTitle } from "../planFormatting";
import type { PlanCourse, PlanSlot, PlanTarget, PlanYear } from "../planTypes";
import { CatalogCourseRow } from "./CatalogCourseRow";
import { CatalogFilters } from "./CatalogFilters";

interface AddCourseDialogProps {
	/** The year and semester the dialog was opened from; null when closed. */
	readonly target: PlanTarget | null;
	readonly years: readonly PlanYear[];
	readonly plannedCourseIds: ReadonlySet<string>;
	/** Planned years are picked from what the current catalog offers. */
	readonly catalogYearStart: number;
	readonly onAdd: (
		target: PlanTarget,
		course: PlanCourse,
		slot: PlanSlot,
	) => void;
	readonly onClose: () => void;
}

export function AddCourseDialog({
	target,
	onClose,
	...props
}: AddCourseDialogProps) {
	return (
		<Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className="flex h-[min(44rem,calc(100dvh-8rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
				data-testid={testIds.personalPlan.addDialog}
			>
				{/* Keyed so each opening starts from that semester's defaults. */}
				{target ? (
					<AddCourseDialogBody
						key={`${target.studyYear}-${target.term}`}
						target={target}
						{...props}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function AddCourseDialogBody({
	target,
	years,
	plannedCourseIds,
	catalogYearStart,
	onAdd,
}: Readonly<Omit<AddCourseDialogProps, "onClose"> & { target: PlanTarget }>) {
	const { speciality } = useAuth();
	const [filters, setFilters] = useState(() =>
		defaultCatalogFilters(target.term),
	);
	const [pageSize, setPageSize] = useState(CATALOG_PAGE_SIZE);
	const catalog = useCatalogCourses(filters, catalogYearStart, pageSize);

	const year = years.find((item) => item.studyYear === target.studyYear);
	const destination = { studyYear: target.studyYear, term: filters.term };
	const loaded = catalog.data?.items ?? [];
	// Courses already in the plan are not offered again; they drop out of
	// the list (and the count) as soon as they are added.
	const courses = loaded.filter(
		(course) => !plannedCourseIds.has(course.id ?? ""),
	);
	const hiddenCount = loaded.length - courses.length;
	const total = Math.max((catalog.data?.total ?? 0) - hiddenCount, 0);
	const hasMore = (catalog.data?.total ?? 0) > loaded.length;

	const changeFilters = (patch: Partial<Filters>) => {
		setFilters((current) => ({ ...current, ...patch }));
		setPageSize(CATALOG_PAGE_SIZE);
	};

	return (
		<>
			<DialogHeader className="gap-1 px-6 pt-5 pb-3">
				<DialogTitle>Додати дисципліну</DialogTitle>
				<DialogDescription>
					{target.studyYear} курс
					{year
						? ` · ${formatAcademicYearLabel(year.academicYearStart, "FALL")}`
						: null}
					{" · додається в: "}
					{getSemesterTitle(filters.term).toLowerCase()}
				</DialogDescription>
			</DialogHeader>

			<div className="border-b px-6 pb-4">
				<CatalogFilters
					filters={filters}
					semesters={year?.semesters ?? []}
					onChange={changeFilters}
				/>
			</div>

			<div className="flex items-center justify-between px-6 pt-2.5 pb-1 text-sm text-muted-foreground">
				<span aria-live="polite">Знайдено: {total}</span>
				<Button
					variant="link"
					size="sm"
					onClick={() => changeFilters(defaultCatalogFilters(target.term))}
				>
					Скинути фільтри
				</Button>
			</div>

			<div className="min-h-0 grow overflow-y-auto px-4 pb-3">
				{catalog.isLoading ? (
					<CatalogSkeleton />
				) : catalog.isError ? (
					<p className="px-2 py-8 text-center text-sm text-destructive">
						Не вдалося завантажити дисципліни. Спробуйте ще раз.
					</p>
				) : courses.length === 0 && !hasMore ? (
					<p className="px-2 py-8 text-center text-sm text-muted-foreground">
						Нічого не знайдено. Спробуйте змінити фільтри.
					</p>
				) : (
					<>
						{courses.map((course) => (
							<CatalogCourseRow
								key={course.id}
								course={course}
								term={filters.term}
								specialityId={speciality?.id}
								onAdd={(planCourse, slot) =>
									onAdd(destination, planCourse, slot)
								}
							/>
						))}
						{hasMore ? (
							<div className="flex justify-center pt-3">
								<Button
									variant="outline"
									size="sm"
									disabled={catalog.isFetching}
									onClick={() =>
										setPageSize((size) => size + CATALOG_PAGE_SIZE)
									}
								>
									Показати ще
								</Button>
							</div>
						) : null}
					</>
				)}
			</div>

			<DialogFooter className="border-t px-6 py-3">
				<DialogClose asChild>
					<Button variant="outline">Готово</Button>
				</DialogClose>
			</DialogFooter>
		</>
	);
}

function CatalogSkeleton() {
	return (
		<div className="flex flex-col gap-2 px-2 py-2">
			{Array.from({ length: 5 }, (_, index) => (
				<Skeleton key={index} className="h-12" />
			))}
		</div>
	);
}

import { useState } from "react";

import { Plus } from "lucide-react";

import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/Command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/Popover";
import {
	getDifficultyTone,
	getFacultyAbbreviation,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import {
	CATEGORY_LABELS,
	formatCredits,
} from "@/features/study-plan/studyPlanRules";
import type {
	PlanCourse,
	PlanCourseCategory,
} from "@/features/study-plan/studyPlanTypes";
import { cn } from "@/lib/utils";
import { CategoryDot } from "./CategoryDot";

interface AddCourseComboboxProps {
	label: string;
	catalog: readonly PlanCourse[];
	excludedTitles: ReadonlySet<string>;
	electiveAvailable: number;
	onSelect: (course: PlanCourse) => void;
	variant?: "primary" | "subtle";
}

const GROUPS: PlanCourseCategory[] = ["PROF_ORIENTED", "ELECTIVE"];

export function AddCourseCombobox({
	label,
	catalog,
	excludedTitles,
	electiveAvailable,
	onSelect,
	variant = "primary",
}: Readonly<AddCourseComboboxProps>) {
	const [open, setOpen] = useState(false);
	const available = catalog.filter((c) => !excludedTitles.has(c.title));

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex w-full items-center gap-2 rounded-md px-2 h-9 text-sm transition-colors cursor-pointer",
						variant === "primary"
							? "border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/[0.03]"
							: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
					)}
				>
					<Plus className="size-3.5" />
					{label}
				</button>
			</PopoverTrigger>
			<PopoverContent
				className="w-[min(24rem,calc(100vw-2rem))] p-0"
				align="start"
			>
				<Command>
					<CommandInput placeholder="Пошук курсу на Rate UKMA…" />
					<CommandList className="max-h-72">
						<CommandEmpty>Курсів не знайдено</CommandEmpty>
						{GROUPS.map((category) => (
							<CommandGroup
								key={category}
								heading={CATEGORY_LABELS[category]}
								className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
							>
								{available
									.filter((c) => c.category === category)
									.map((course) => (
										<CatalogItem
											key={course.id}
											course={course}
											exceedsElective={
												category === "ELECTIVE" &&
												course.credits > electiveAvailable
											}
											onSelect={() => {
												onSelect(course);
												setOpen(false);
											}}
										/>
									))}
							</CommandGroup>
						))}
					</CommandList>
					<div className="border-t px-3 py-2 text-xs text-muted-foreground">
						Вільного вибору доступно ще{" "}
						<span className="font-medium text-foreground">
							{formatCredits(electiveAvailable)}
						</span>
					</div>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

interface CatalogItemProps {
	course: PlanCourse;
	exceedsElective: boolean;
	onSelect: () => void;
}

function CatalogItem({
	course,
	exceedsElective,
	onSelect,
}: Readonly<CatalogItemProps>) {
	return (
		<CommandItem value={course.title} onSelect={onSelect} className="gap-2.5">
			<CategoryDot category={course.category} />
			<div className="flex-1 min-w-0">
				<div className="truncate">{course.title}</div>
				<div className="text-xs text-muted-foreground">
					{course.facultyName && getFacultyAbbreviation(course.facultyName)}
					{course.difficulty != null && (
						<>
							{" · "}складність{" "}
							<span className={getDifficultyTone(course.difficulty)}>
								{course.difficulty.toFixed(1)}
							</span>
						</>
					)}
					{course.usefulness != null && (
						<>
							{" · "}корисність{" "}
							<span className={getUsefulnessTone(course.usefulness)}>
								{course.usefulness.toFixed(1)}
							</span>
						</>
					)}
					{exceedsElective && (
						<span className="text-destructive"> · понад ліміт</span>
					)}
				</div>
			</div>
			<span className="text-xs tabular-nums text-muted-foreground shrink-0">
				{formatCredits(course.credits)}
			</span>
		</CommandItem>
	);
}

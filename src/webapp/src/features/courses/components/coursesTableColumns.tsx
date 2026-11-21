import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/Badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import type { CourseList } from "@/lib/api/generated";
import { EducationLevelEnum } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { CourseColumnHeader } from "./CourseColumnHeader";
import { CourseScoreCell } from "./CourseScoreCell";
import { CourseSpecialityBadges } from "./CourseSpecialityBadges";
import { CoursesReviewsSortMenu } from "./CoursesReviewsSortMenu";
import type { CoursesReviewsSortOption } from "./CoursesReviewsSortMenu";
import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "../courseFormatting";

export function buildCoursesTableColumns({
	reviewsSortValue,
	onReviewsSortChange,
	compact,
}: {
	reviewsSortValue: CoursesReviewsSortOption | null;
	onReviewsSortChange: (value: CoursesReviewsSortOption) => void;
	compact: boolean;
}): ColumnDef<CourseList>[] {
	return [
		{
			id: "title",
			accessorKey: "title",
			header: ({ column }) => (
				<CourseColumnHeader column={column} title="Назва дисципліни" />
			),
			cell: ({ row }) => {
				const course = row.original;
				const courseId = course.id;
				return (
					<span className="inline-flex flex-wrap items-center gap-1.5 whitespace-normal break-words">
						{courseId ? (
							<Link
								to="/courses/$courseId"
								params={{ courseId }}
								className="line-clamp-2 text-sm font-medium transition-colors motion-reduce:transition-none underline-offset-4 hover:text-primary hover:underline md:text-base"
								data-testid={testIds.courses.tableTitleLink}
							>
								{course.title}
							</Link>
						) : (
							<span className="line-clamp-2 text-sm font-medium md:text-base">
								{course.title}
							</span>
						)}
						{course.education_level === EducationLevelEnum.MASTER && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Badge
										variant="outline"
										className="shrink-0 cursor-default px-1.5"
									>
										М
									</Badge>
								</TooltipTrigger>
								<TooltipContent side="top">Магістр</TooltipContent>
							</Tooltip>
						)}
						<CourseSpecialityBadges specialities={course.specialities} />
					</span>
				);
			},
			enableSorting: false,
			size: compact ? 160 : 300,
			meta: {
				label: "Назва дисципліни",
				placeholder: "Пошук дисциплін...",
				variant: "text",
				align: "left",
			},
		},
		{
			id: "ratings_count",
			accessorKey: "ratings_count",
			header: () => (
				<div className="hidden text-muted-foreground sm:block">
					<CoursesReviewsSortMenu
						value={reviewsSortValue}
						onValueChange={onReviewsSortChange}
					/>
				</div>
			),
			cell: ({ row }) => {
				const count = row.original.ratings_count;
				return (
					<div className="hidden sm:flex items-center justify-center">
						<span className="text-sm font-medium tabular-nums text-muted-foreground md:text-base">
							{count}
						</span>
					</div>
				);
			},
			enableSorting: false,
			meta: {
				label: "Відгуки",
				align: "center",
				hideOnMobile: true,
			},
		},
		{
			id: "avg_difficulty",
			accessorKey: "avg_difficulty",
			header: ({ column }) => (
				<>
					<div className="flex justify-center md:hidden">
						<CourseColumnHeader
							column={column}
							title="Склад."
							initialSortDirection="asc"
							testId={testIds.courses.difficultySortButtonMobile}
							align="center"
							className="h-10 whitespace-nowrap text-xs [&_svg]:size-3.5"
						/>
					</div>
					<div className="hidden justify-center md:flex">
						<CourseColumnHeader
							column={column}
							title="Складність"
							initialSortDirection="asc"
							testId={testIds.courses.difficultySortButtonDesktop}
							align="center"
						/>
					</div>
				</>
			),
			cell: ({ row }) => (
				<CourseScoreCell
					value={row.original.avg_difficulty}
					variant="difficulty"
				/>
			),
			enableSorting: true,
			size: compact ? 80 : 100,
			meta: {
				label: "Складність",
				placeholder: "Фільтр за складністю...",
				variant: "number",
				range: DIFFICULTY_RANGE,
				align: "center",
			},
		},
		{
			id: "avg_usefulness",
			accessorKey: "avg_usefulness",
			header: ({ column }) => (
				<>
					<div className="flex justify-center md:hidden">
						<CourseColumnHeader
							column={column}
							title="Корис."
							initialSortDirection="desc"
							testId={testIds.courses.usefulnessSortButtonMobile}
							align="center"
							className="h-10 whitespace-nowrap text-xs [&_svg]:size-3.5"
						/>
					</div>
					<div className="hidden justify-center md:flex">
						<CourseColumnHeader
							column={column}
							title="Корисність"
							initialSortDirection="desc"
							testId={testIds.courses.usefulnessSortButtonDesktop}
							align="center"
						/>
					</div>
				</>
			),
			cell: ({ row }) => (
				<CourseScoreCell
					value={row.original.avg_usefulness}
					variant="usefulness"
				/>
			),
			enableSorting: true,
			size: compact ? 80 : 100,
			meta: {
				label: "Корисність",
				placeholder: "Фільтр за корисністю...",
				variant: "number",
				range: USEFULNESS_RANGE,
			},
		},
	];
}

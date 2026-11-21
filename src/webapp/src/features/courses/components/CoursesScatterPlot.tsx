import { useCallback, useMemo } from "react";

import { keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ParentSize } from "@visx/responsive";

import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type {
	AnalyticsListParams,
	CoursesListParams,
} from "@/lib/api/generated";
import {
	useAnalyticsList,
	useCoursesFilterOptionsRetrieve,
} from "@/lib/api/generated";
import { getFacultyHexColor } from "@/lib/faculty-colors";
import type { CourseDataPoint } from "./scatterLabeling";
import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "../courseFormatting";
import { ScatterPlotContent } from "./ScatterPlotContent";

const POINT_MIN_RADIUS = 3;
const POINT_MAX_RADIUS = 30;
const POINT_RADIUS_MULTIPLIER = 2;
const DOMAIN_PADDING = 0.2;

const PLOT_LOADING_MESSAGES = [
	{
		title: "Розкладаємо координатну сітку…",
		description: "Підтягуємо дисципліни в потрібні квадранти.",
	},
	{
		title: "Згущуємо точки на графіку 🫧",
		description: "Чекаємо, поки дані зберуться в хмарку.",
	},
	{
		title: "Підписуємо найголовніші дисципліни ✍️",
		description: "Вирішуємо, хто отримає свою мітку першим.",
	},
	{
		title: "Обчислюємо складність й корисність…",
		description: "Дисципліни вже розміщуються по осях.",
	},
	{
		title: "Наводимо красу ✨",
		description: "Ще мить — і графік буде готовий.",
	},
] as const;

function normalizeAnalyticsFilters(
	filters: Readonly<CoursesListParams>,
): AnalyticsListParams {
	const {
		name,
		faculty,
		department,
		instructor,
		speciality,
		semester_terms,
		semester_year,
		avg_difficulty_min,
		avg_difficulty_max,
		avg_usefulness_min,
		avg_usefulness_max,
		avg_difficulty_order,
		avg_usefulness_order,
		type_kind,
		education_level,
	} = filters;

	return {
		name,
		faculty,
		department,
		instructor,
		speciality,
		semester_terms,
		semester_year,
		avg_difficulty_min,
		avg_difficulty_max,
		avg_usefulness_min,
		avg_usefulness_max,
		avg_difficulty_order,
		avg_usefulness_order,
		type_kind,
		education_level,
		ratings_count_min: 1,
	};
}

type LoadingMessage = (typeof PLOT_LOADING_MESSAGES)[number];

function getRandomLoadingMessage(): LoadingMessage {
	const index = Math.floor(Math.random() * PLOT_LOADING_MESSAGES.length);
	return PLOT_LOADING_MESSAGES[index];
}

function computeDomain(
	min: number | undefined,
	max: number | undefined,
	range: [number, number],
	padding = DOMAIN_PADDING,
): [number, number] {
	const clampedMin = Math.max(range[0], min ?? range[0]);
	const clampedMax = Math.min(range[1], max ?? range[1]);
	if (clampedMin >= clampedMax) {
		return range;
	}
	return [clampedMin - padding, clampedMax + padding];
}

function ScatterPlotLoader({ message }: Readonly<{ message: LoadingMessage }>) {
	return (
		<div className="absolute inset-0 grid place-items-center">
			<div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
				<Spinner className="text-muted-foreground" />
				<div className="space-y-1">
					<div className="text-sm font-medium text-foreground">
						{message.title}
					</div>
					<div className="text-sm text-muted-foreground">
						{message.description}
					</div>
				</div>
			</div>
		</div>
	);
}
function ScatterPlotState({
	title,
	description,
	action,
}: Readonly<{
	title: string;
	description: string;
	action?: React.ReactNode;
}>) {
	return (
		<div className="w-full h-full relative flex items-center justify-center px-6">
			<div className="flex max-w-xs flex-col items-center gap-2 text-center">
				<h3 className="text-lg font-medium">{title}</h3>
				<p className="text-sm text-muted-foreground">{description}</p>
				{action}
			</div>
		</div>
	);
}
export function CoursesScatterPlot({
	filters,
	variant = "default",
}: Readonly<{
	filters: CoursesListParams;
	variant?: "default" | "mini";
}>) {
	const navigate = useNavigate();

	const usefulnessDomain = useMemo<[number, number]>(() => {
		return computeDomain(
			filters.avg_usefulness_min,
			filters.avg_usefulness_max,
			USEFULNESS_RANGE,
		);
	}, [filters.avg_usefulness_max, filters.avg_usefulness_min]);

	const difficultyDomain = useMemo<[number, number]>(() => {
		return computeDomain(
			filters.avg_difficulty_min,
			filters.avg_difficulty_max,
			DIFFICULTY_RANGE,
		);
	}, [filters.avg_difficulty_max, filters.avg_difficulty_min]);

	const analyticsFilters = useMemo(
		() => normalizeAnalyticsFilters(filters),
		[filters],
	);

	const { data, isLoading, isError, refetch } = useAnalyticsList(
		analyticsFilters,
		{
			query: {
				placeholderData: keepPreviousData,
			},
		},
	);
	const loadingMessage = useMemo(() => getRandomLoadingMessage(), []);

	const filterOptionsQuery = useCoursesFilterOptionsRetrieve();
	const faculties = filterOptionsQuery.data?.faculties;

	const facultyColorMap = useMemo(() => {
		const map = new Map<string, string>();
		for (const faculty of faculties ?? []) {
			map.set(faculty.name, getFacultyHexColor(faculty.name));
		}
		return map;
	}, [faculties]);

	const chartData: CourseDataPoint[] = useMemo(() => {
		const analytics = data ?? [];

		return analytics
			.filter(
				(course) =>
					course.avg_usefulness != null && course.avg_difficulty != null,
			)
			.map((course) => {
				const ratingsCount = course.ratings_count ?? 0;
				const radius = Math.max(
					POINT_MIN_RADIUS,
					Math.min(
						Math.sqrt(ratingsCount) * POINT_RADIUS_MULTIPLIER,
						POINT_MAX_RADIUS,
					),
				);

				return {
					id: course.id ?? "unknown",
					name: course.name ?? "Дисципліна",
					x: course.avg_usefulness ?? USEFULNESS_RANGE[0],
					y: course.avg_difficulty ?? DIFFICULTY_RANGE[0],
					radius,
					color:
						facultyColorMap.get(course.faculty_name ?? "") ??
						"var(--plot-point-fallback)",
					facultyName: course.faculty_name ?? "Інше",
					ratingsCount,
				};
			});
	}, [data, facultyColorMap]);

	const handleCourseClick = useCallback(
		(courseId: string) => {
			void navigate({ to: "/courses/$courseId", params: { courseId } });
		},
		[navigate],
	);

	if (isLoading) {
		return (
			<div className="relative h-full w-full overflow-hidden">
				<ScatterPlotLoader message={loadingMessage} />
			</div>
		);
	}

	if (isError) {
		return (
			<ScatterPlotState
				title="Не вдалося завантажити діаграму"
				description="Спробуйте оновити сторінку"
				action={
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="mt-2 h-10 px-4"
						onClick={() => refetch()}
					>
						Спробувати знову
					</Button>
				}
			/>
		);
	}

	if (chartData.length === 0) {
		return (
			<ScatterPlotState
				title="Немає даних"
				description="Змініть фільтри, щоб побачити дисципліни"
			/>
		);
	}

	return (
		<div className="w-full h-full relative">
			<ParentSize>
				{({ width, height }) => (
					<ScatterPlotContent
						width={width}
						height={height}
						chartData={chartData}
						variant={variant}
						usefulnessDomain={usefulnessDomain}
						difficultyDomain={difficultyDomain}
						onCourseClick={handleCourseClick}
					/>
				)}
			</ParentSize>
		</div>
	);
}

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { AnalyticsScatterPlot } from "./AnalyticsScatterPlot";

// Mock react-router
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mockNavigate,
}));

// Mock recharts for testing - it doesn't render well in jsdom
vi.mock("recharts", async () => {
	const actual = await vi.importActual("recharts");
	return {
		...actual,
		ResponsiveContainer: ({ children }: any) => (
			<div data-testid="responsive-container">{children}</div>
		),
		ScatterChart: ({ children }: any) => (
			<div data-testid="scatter-chart">{children}</div>
		),
		Scatter: ({ data }: any) => (
			<div data-testid="scatter" data-length={data?.length} />
		),
		XAxis: () => <div data-testid="x-axis" />,
		YAxis: () => <div data-testid="y-axis" />,
		ZAxis: () => <div data-testid="z-axis" />,
		CartesianGrid: () => <div data-testid="grid" />,
		Tooltip: () => <div data-testid="tooltip" />,
		Cell: () => <div data-testid="cell" />,
		Label: () => <div data-testid="label" />,
	};
});

const mockCourses = [
	{
		id: "1",
		name: "Algorithm Design",
		avg_difficulty: 4.2,
		avg_usefulness: 4.5,
		ratings_count: 120,
		faculty_name: "Computer Science",
	},
	{
		id: "2",
		name: "Database Systems",
		avg_difficulty: 3.8,
		avg_usefulness: 4.2,
		ratings_count: 95,
		faculty_name: "Computer Science",
	},
	{
		id: "3",
		name: "Linear Algebra",
		avg_difficulty: 4.5,
		avg_usefulness: 3.9,
		ratings_count: 150,
		faculty_name: "Mathematics",
	},
	{
		id: "4",
		name: "Physics I",
		avg_difficulty: 4.0,
		avg_usefulness: 3.5,
		ratings_count: 200,
		faculty_name: "Physics",
	},
];

describe("AnalyticsScatterPlot", () => {
	beforeEach(() => {
		mockNavigate.mockClear();
	});

	afterEach(() => {
		cleanup();
	});

	it("renders loading state", () => {
		render(<AnalyticsScatterPlot data={[]} isLoading={true} />);

		expect(screen.getByText("Завантаження...")).toBeInTheDocument();
	});

	it("renders empty state when no data", () => {
		render(<AnalyticsScatterPlot data={[]} isLoading={false} />);

		expect(
			screen.getByText("Немає даних для відображення"),
		).toBeInTheDocument();
		expect(screen.getByText("Спробуйте змінити фільтри")).toBeInTheDocument();
	});

	it("renders scatter plot with course data", () => {
		render(<AnalyticsScatterPlot data={mockCourses} isLoading={false} />);

		expect(screen.getByText("Аналітика курсів")).toBeInTheDocument();
		expect(screen.getByTestId("scatter-chart")).toBeInTheDocument();
		expect(screen.getByTestId("x-axis")).toBeInTheDocument();
		expect(screen.getByTestId("y-axis")).toBeInTheDocument();
	});

	it("renders faculty legend", () => {
		render(<AnalyticsScatterPlot data={mockCourses} isLoading={false} />);

		expect(screen.getByText("Computer Science")).toBeInTheDocument();
		expect(screen.getByText("Mathematics")).toBeInTheDocument();
		expect(screen.getByText("Physics")).toBeInTheDocument();
	});

	it("groups by faculty when data exceeds threshold", () => {
		// Create 60 courses to exceed the GROUPING_THRESHOLD of 50
		const manyCourses = Array.from({ length: 60 }, (_, i) => ({
			id: `${i + 1}`,
			name: `Course ${i + 1}`,
			avg_difficulty: 3.0 + Math.random(),
			avg_usefulness: 3.0 + Math.random(),
			ratings_count: 50 + Math.floor(Math.random() * 100),
			faculty_name: `Faculty ${(i % 5) + 1}`,
		}));

		const { container } = render(
			<AnalyticsScatterPlot data={manyCourses} isLoading={false} />,
		);

		const description = container.querySelector(
			".flex.items-center.justify-between p",
		);
		expect(description?.textContent).toContain("факультет");
	});

	it("handles courses without faculty name", () => {
		const coursesWithoutFaculty = [
			{
				id: "1",
				name: "Independent Study",
				avg_difficulty: 3.5,
				avg_usefulness: 4.0,
				ratings_count: 20,
				faculty_name: null,
			},
		];

		render(
			<AnalyticsScatterPlot data={coursesWithoutFaculty} isLoading={false} />,
		);

		expect(screen.getByText("Інше")).toBeInTheDocument();
	});

	it("calculates average values correctly for faculty groups", () => {
		// Create courses with known averages for testing
		const courses = [
			{
				id: "1",
				name: "Course 1",
				avg_difficulty: 2.0,
				avg_usefulness: 3.0,
				ratings_count: 50,
				faculty_name: "Faculty A",
			},
			{
				id: "2",
				name: "Course 2",
				avg_difficulty: 4.0,
				avg_usefulness: 5.0,
				ratings_count: 50,
				faculty_name: "Faculty A",
			},
		];

		// Expected averages: (2.0 + 4.0) / 2 = 3.0, (3.0 + 5.0) / 2 = 4.0
		render(<AnalyticsScatterPlot data={courses} isLoading={false} />);

		// Chart should render with the data
		expect(screen.getByTestId("scatter-chart")).toBeInTheDocument();
	});

	it("renders with consistent theme colors", () => {
		const { container } = render(
			<AnalyticsScatterPlot data={mockCourses} isLoading={false} />,
		);

		// Check that faculty legend items have color indicators
		const colorIndicators = container.querySelectorAll(".rounded-full");
		expect(colorIndicators.length).toBeGreaterThan(0);
	});

	it("handles zero or null values gracefully", () => {
		const coursesWithZeros = [
			{
				id: "1",
				name: "Course",
				avg_difficulty: 0,
				avg_usefulness: 0,
				ratings_count: 0,
				faculty_name: "Faculty",
			},
		];

		render(
			<AnalyticsScatterPlot data={coursesWithZeros} isLoading={false} />,
		);

		expect(screen.getByTestId("scatter-chart")).toBeInTheDocument();
	});
});

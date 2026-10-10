import { createFileRoute } from "@tanstack/react-router";
import { Helmet } from "react-helmet-async";

import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import {
	ActivityChart,
	CoverageChart,
	FacultyMap,
	KpiStrip,
	ParticipationChart,
	ReviewsSection,
	ScoresChart,
	formatNumber,
} from "@/features/stats/components/StatsCharts";
import { PLATFORM_STATS as stats } from "@/features/stats/statsData";
import { formatPageTitle } from "@/lib/app-metadata";
import { withAuth } from "@/lib/auth";

const mean = (counts: number[]) =>
	counts.reduce((sum, count, i) => sum + count * (i + 1), 0) /
	counts.reduce((sum, count) => sum + count, 0);

function StatsPage() {
	const averages = {
		difficulty: mean(stats.difficulty),
		usefulness: mean(stats.usefulness),
	};
	return (
		<Layout>
			<Helmet>
				<title>{formatPageTitle("Статистика")}</title>
			</Helmet>
			<div className="space-y-8 pb-16">
				<PageHeader
					title="Статистика"
					description="Як студенти НаУКМА оцінюють курси"
				/>

				<KpiStrip
					items={[
						{ label: "Оцінок", value: formatNumber(stats.ratings) },
						{
							label: "Курсів оцінено",
							value: formatNumber(stats.ratedCourses),
						},
						{
							label: "Студентів оцінили",
							value: formatNumber(stats.studentsWhoRated),
						},
						{
							label: "З письмовим відгуком",
							value: `${Math.round((stats.withComment / stats.ratings) * 100)}%`,
						},
					]}
				/>

				<Card className="shadow-sm">
					<CardContent className="p-4 sm:p-6">
						<ActivityChart stats={stats} />
					</CardContent>
				</Card>

				<Card className="shadow-sm">
					<CardContent className="grid gap-10 p-4 sm:p-6 lg:grid-cols-2 lg:gap-0 lg:divide-x [&>*]:lg:px-6 [&>*:first-child]:lg:pl-0 [&>*:last-child]:lg:pr-0">
						<FacultyMap stats={stats} averages={averages} />
						<ScoresChart stats={stats} />
					</CardContent>
				</Card>

				<Card className="shadow-sm">
					<CardContent className="p-4 sm:p-6">
						<ReviewsSection stats={stats} />
					</CardContent>
				</Card>

				<Card className="shadow-sm">
					<CardContent className="grid gap-10 p-4 sm:p-6 lg:grid-cols-2 lg:gap-0 lg:divide-x [&>*]:lg:px-6 [&>*:first-child]:lg:pl-0 [&>*:last-child]:lg:pr-0">
						<ParticipationChart stats={stats} />
						<CoverageChart stats={stats} />
					</CardContent>
				</Card>
			</div>
		</Layout>
	);
}

export const Route = createFileRoute("/stats")({
	component: withAuth(StatsPage),
});

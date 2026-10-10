import { createFileRoute } from "@tanstack/react-router";
import { Helmet } from "react-helmet-async";

import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeader } from "@/components/SectionHeader";
import {
	ChartCard,
	ColumnChart,
	FacultyList,
	Funnel,
	MonthStrip,
	ParticipationList,
	ScoreSplit,
	StatTile,
	formatNumber,
} from "@/features/stats/components/StatsCharts";
import { PLATFORM_STATS as stats } from "@/features/stats/statsData";
import { formatPageTitle } from "@/lib/app-metadata";
import { withAuth } from "@/lib/auth";

function StatsPage() {
	const commentShare = Math.round((stats.withComment / stats.ratings) * 100);
	return (
		<Layout>
			<Helmet>
				<title>{formatPageTitle("Статистика")}</title>
			</Helmet>
			<div className="space-y-10 pb-16">
				<PageHeader
					title="Статистика"
					description="Як студенти НаУКМА оцінюють курси"
				/>

				<div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
					<StatTile label="Оцінок" value={formatNumber(stats.ratings)} />
					<StatTile
						label="Курсів оцінено"
						value={formatNumber(stats.ratedCourses)}
					/>
					<StatTile
						label="Студентів оцінили"
						value={formatNumber(stats.studentsWhoRated)}
					/>
					<StatTile label="З відгуком" value={`${commentShare}%`} />
				</div>

				<section className="space-y-4">
					<SectionHeader title="Оцінки" />
					<div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
						<ChartCard title="За навчальним роком курсу">
							<ColumnChart
								barClassName="bg-primary"
								items={stats.byAcademicYear.map((y) => ({
									key: String(y.year),
									label: `${String(y.year).slice(2)}–${String(y.year + 1).slice(2)}`,
									value: y.ratings,
								}))}
							/>
						</ChartCard>
						<ChartCard title="Коли пишуть">
							<MonthStrip byMonth={stats.byMonth} />
						</ChartCard>
					</div>
				</section>

				<section className="space-y-4">
					<SectionHeader title="Як оцінюють" />
					<div className="grid grid-cols-2 gap-3 sm:gap-4">
						<ChartCard title="Складність">
							<ScoreSplit counts={stats.difficulty} barClassName="bg-chart-5" />
						</ChartCard>
						<ChartCard title="Корисність">
							<ScoreSplit counts={stats.usefulness} barClassName="bg-primary" />
						</ChartCard>
					</div>
				</section>

				<section className="space-y-4">
					<SectionHeader title="Хто оцінює" />
					<div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
						<ChartCard title="Студенти">
							<Funnel
								steps={[
									{ label: "Усього", value: stats.students },
									{ label: "Увійшли на сайт", value: stats.studentsSignedIn },
									{
										label: "Оцінили хоч один курс",
										value: stats.studentsWhoRated,
									},
								]}
							/>
						</ChartCard>
						<ChartCard title="Частка студентів, що оцінили">
							<ParticipationList faculties={stats.faculties} />
						</ChartCard>
					</div>
				</section>

				<section className="space-y-4">
					<SectionHeader title="Факультети" />
					<FacultyList faculties={stats.faculties} />
				</section>
			</div>
		</Layout>
	);
}

export const Route = createFileRoute("/stats")({
	component: withAuth(StatsPage),
});

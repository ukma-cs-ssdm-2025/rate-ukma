import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { caseKinds, type Overview } from "../api/schemas";
import { CASE_KIND_LABELS, formatDateTime } from "../reviewCases";

const LIST_LABELS: Record<string, string> = {
	courses: "Курси",
	offerings: "Пропозиції",
	instructors: "Викладачі",
	students: "Студенти",
	enrollments: "Записи на курси",
};

const count = new Intl.NumberFormat("uk-UA");

export function OverviewPanel({ data }: Readonly<{ data: Overview }>) {
	const totalOpen = caseKinds.reduce(
		(sum, kind) => sum + data.openCases[kind],
		0,
	);
	return (
		<div className="grid gap-4 md:grid-cols-3">
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Остання синхронізація</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<p className="text-2xl font-semibold">
						{formatDateTime(data.lastSync.finishedAt)}
					</p>
					<Badge variant={data.lastSync.ok ? "success" : "soft-destructive"}>
						{data.lastSync.ok ? "Успішно" : "З помилкою"}
					</Badge>
					<p className="text-muted-foreground">
						Номер зміни: {count.format(data.lastSync.cursor)}
					</p>
					<p className="text-muted-foreground">
						Дані САЗ оновлено {formatDateTime(data.dataUpdatedAt)}
					</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Рядки за списками</CardTitle>
				</CardHeader>
				<CardContent>
					<dl className="space-y-1 text-sm">
						{data.lists.map((list) => (
							<div key={list.name} className="flex justify-between gap-4">
								<dt className="text-muted-foreground">
									{LIST_LABELS[list.name] ?? list.name}
								</dt>
								<dd className="font-medium tabular-nums">
									{count.format(list.rows)}
								</dd>
							</div>
						))}
					</dl>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						Відкриті справи: {totalOpen}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-1 text-sm">
					{caseKinds.map((kind) => (
						<Link
							key={kind}
							to="/data/cases"
							search={{ kind, status: "open" }}
							className="flex justify-between gap-4 rounded-md py-1 hover:text-primary"
						>
							<span>{CASE_KIND_LABELS[kind]}</span>
							<span className="font-medium tabular-nums">
								{data.openCases[kind]}
							</span>
						</Link>
					))}
					<p className="pt-2 text-muted-foreground">
						{data.oldestOpenAt
							? `Найстаріша відкрита з ${formatDateTime(data.oldestOpenAt)}`
							: "Відкритих справ немає"}
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

export function OverviewPanelSkeleton() {
	return (
		<div className="grid gap-4 md:grid-cols-3">
			{[0, 1, 2].map((index) => (
				<Skeleton key={index} className="h-56 rounded-xl" />
			))}
		</div>
	);
}

import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
	type UkmaDataStatus,
	useUkmaDataDepartmentsList,
	useUkmaDataFacultiesList,
	useUkmaDataOfferingsList,
	useUkmaDataProgrammesList,
	useUkmaDataReviewCasesList,
	useUkmaDataTermsList,
} from "@/lib/api/generated";
import {
	CASE_KIND_LABELS,
	caseKinds,
	formatDateTime,
	NO_RETRY,
	PAGE,
} from "../reviewCases";

const count = new Intl.NumberFormat("uk-UA");

interface ListPage {
	readonly items?: ReadonlyArray<{
		readonly id?: string;
		readonly removed_at?: string | null;
	}>;
	readonly has_more?: boolean;
}

function KeyCard({ status }: Readonly<{ status: UkmaDataStatus }>) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Дані САЗ</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2 text-sm">
				<p className="text-2xl font-semibold">
					{status.data_updated_at
						? formatDateTime(status.data_updated_at)
						: "Ще не оновлено"}
				</p>
				<p className="text-muted-foreground">
					Коли UKMA Data востаннє прочитав САЗ.
				</p>
				<p className="pt-2 text-muted-foreground">
					Ключ {status.key_id}, діє до{" "}
					{status.key_expires_at ? formatDateTime(status.key_expires_at) : "—"}
				</p>
				<div className="flex flex-wrap gap-1">
					{status.scopes?.map((scope) => (
						<Badge key={scope} variant="outline">
							{scope}
						</Badge>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function ListRow({
	label,
	page,
	isError,
}: Readonly<{ label: string; page: ListPage | undefined; isError: boolean }>) {
	const live = page?.items?.filter((item) => !item.removed_at).length ?? 0;
	return (
		<div className="flex justify-between gap-4">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="font-medium tabular-nums">
				{isError
					? "не завантажено"
					: page
						? `${page.has_more ? "щонайменше " : ""}${count.format(live)}`
						: "…"}
			</dd>
		</div>
	);
}

function ListsCard() {
	const terms = useUkmaDataTermsList(PAGE, NO_RETRY);
	const faculties = useUkmaDataFacultiesList(PAGE, NO_RETRY);
	const departments = useUkmaDataDepartmentsList(PAGE, NO_RETRY);
	const programmes = useUkmaDataProgrammesList(PAGE, NO_RETRY);
	const offerings = useUkmaDataOfferingsList(PAGE, NO_RETRY);
	const rows = [
		["Семестри", terms],
		["Факультети", faculties],
		["Кафедри", departments],
		["Програми", programmes],
		["Пропозиції курсів", offerings],
	] as const;
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Чинні рядки за списками</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="space-y-1 text-sm" aria-label="Чинні рядки за списками">
					{rows.map(([label, query]) => (
						<ListRow
							key={label}
							label={label}
							page={query.data}
							isError={query.isError}
						/>
					))}
				</dl>
				{offerings.data?.has_more ? (
					<p className="pt-2 text-sm text-muted-foreground">
						Лічимо лише першу сторінку з {count.format(PAGE.limit)} рядків.
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}

function OpenCasesCard() {
	const { data, isError, isLoading } = useUkmaDataReviewCasesList(
		PAGE,
		NO_RETRY,
	);
	const open = data?.items?.filter((item) => item.status === "open") ?? [];
	const oldest = open.reduce<string | undefined>(
		(min, item) =>
			item.opened_at && (!min || item.opened_at < min) ? item.opened_at : min,
		undefined,
	);
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">
					Відкриті справи{data ? `: ${open.length}` : ""}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-1 text-sm">
				{isLoading ? <Skeleton className="h-20" /> : null}
				{isError ? (
					<p className="text-muted-foreground">Справи не завантажено.</p>
				) : null}
				{data
					? caseKinds.map((kind) => (
							<Link
								key={kind}
								to="/data/cases"
								search={{ kind, status: "open" }}
								className="flex justify-between gap-4 rounded-md py-1 hover:text-primary"
							>
								<span>{CASE_KIND_LABELS[kind]}</span>
								<span className="font-medium tabular-nums">
									{open.filter((item) => item.kind === kind).length}
								</span>
							</Link>
						))
					: null}
				{data ? (
					<p className="pt-2 text-muted-foreground">
						{oldest
							? `Найстаріша відкрита з ${formatDateTime(oldest)}`
							: "Відкритих справ немає"}
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}

export function OverviewPanel({
	status,
}: Readonly<{ status: UkmaDataStatus }>) {
	return (
		<div className="grid gap-4 md:grid-cols-3">
			<KeyCard status={status} />
			<ListsCard />
			<OpenCasesCard />
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

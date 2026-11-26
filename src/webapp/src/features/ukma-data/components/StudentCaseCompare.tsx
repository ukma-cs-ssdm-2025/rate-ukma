import { Skeleton } from "@/components/ui/Skeleton";
import { useUkmaDataStudentCaseRetrieve } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import { NO_RETRY } from "../reviewCases";
import { studentComparison } from "../studentCase";
import { UkmaDataError } from "./UkmaDataError";

export function StudentCaseCompare({ caseId }: Readonly<{ caseId: string }>) {
	const found = useUkmaDataStudentCaseRetrieve(caseId, NO_RETRY);
	if (found.isLoading) {
		return (
			<div
				role="status"
				aria-label="Завантажую дані студентів"
				className="space-y-3 rounded-xl border bg-card p-5"
			>
				<Skeleton className="h-5 w-1/3" />
				<Skeleton className="h-4 w-2/3" />
				<Skeleton className="h-24 w-full" />
			</div>
		);
	}
	if (found.error || found.data === undefined) {
		return (
			<UkmaDataError
				error={found.error}
				title="Не вдалося завантажити дані студентів"
				onRetry={() => void found.refetch()}
				isRetrying={found.isRefetching}
			/>
		);
	}
	const { columns, rows, summary } = studentComparison(found.data);
	return (
		<section
			aria-labelledby="student-compare"
			className="overflow-hidden rounded-xl border bg-card"
		>
			<div className="space-y-1 border-b px-4 py-3 sm:px-5">
				<h3 id="student-compare" className="font-medium">
					Це та сама людина?
				</h3>
				<p className="text-sm text-muted-foreground">{summary}</p>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b text-left text-muted-foreground">
							<th
								scope="col"
								className="w-24 py-2 pr-3 pl-4 font-normal sm:w-36 sm:px-5"
							>
								<span className="sr-only">Поле</span>
							</th>
							{columns.map((column) => (
								<th
									key={column.key}
									scope="col"
									className={cn(
										"px-3 py-2 font-normal sm:px-4",
										columns.length > 2 && "min-w-36",
									)}
								>
									{column.heading}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y">
						{rows.map((row) => (
							<tr key={row.field}>
								<th
									scope="row"
									className="py-2.5 pr-3 pl-4 text-left align-top font-normal text-muted-foreground sm:px-5"
								>
									{row.label}
								</th>
								{row.values.map((value, index) => (
									<td
										key={columns[index]?.key ?? index}
										className="px-3 py-2.5 align-top break-words sm:px-4"
									>
										<span
											className={cn(
												row.differs[index] &&
													"-mx-1 rounded-sm bg-tint-caution box-decoration-clone px-1 text-tint-caution-foreground",
											)}
										>
											{value}
										</span>
										{row.differs[index] ? (
											<span className="sr-only"> (інакше, ніж у записі)</span>
										) : null}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}

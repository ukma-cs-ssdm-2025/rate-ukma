import { Link } from "@tanstack/react-router";

import { Button, buttonVariants } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { UkmaDataReviewCaseKindEnum } from "@/lib/api/generated";
import { kindMeaning } from "../reviewCases";
import { errorCopy, ukmaErrorKind } from "../ukmaDataErrors";
import { DataChip } from "./DataBits";
import { DataLine } from "./DataLines";
import { SyncChip } from "./SyncBits";
import { useStaffRecheck } from "./UkmaDataError";

const viewClass = buttonVariants({ size: "lg", variant: "outline" });

export function SyncWaitingLine({
	title,
	primary,
}: Readonly<{ title: string; primary: boolean }>) {
	return (
		<DataLine
			title={title}
			effect="Нові дисципліни й семестри, оновлені дані та схожі на дублікати. Без вашого підтвердження на сайті нічого не змінюється."
			chip={<SyncChip chip="changes" />}
			action={
				<Link
					to="/data/sync"
					className={primary ? buttonVariants({ size: "lg" }) : viewClass}
				>
					Переглянути
				</Link>
			}
		/>
	);
}

export function CaseWaitingLine({
	kind,
	title,
	primary,
}: Readonly<{
	kind: UkmaDataReviewCaseKindEnum | null;
	title: string;
	primary: boolean;
}>) {
	return (
		<DataLine
			title={title}
			effect={
				kind === null
					? "Справи — питання, які не вдалося вирішити автоматично. Тим часом діє безпечна відповідь."
					: kindMeaning(kind)
			}
			chip={<DataChip tone="muted">Вирішують поза сайтом</DataChip>}
			action={
				<Link
					to="/data/cases"
					search={kind === null ? { status: "open" } : { kind, status: "open" }}
					className={primary ? buttonVariants({ size: "lg" }) : viewClass}
				>
					Переглянути
				</Link>
			}
		/>
	);
}

export function IssueLine({
	error,
	area,
	onRetry,
}: Readonly<{ error: unknown; area: string; onRetry: () => void }>) {
	const kind = ukmaErrorKind(error);
	useStaffRecheck(kind);
	const copy = errorCopy(kind, `${area}: не вдалося завантажити`);
	return (
		<DataLine
			title={kind === "forbidden" ? `${area} не можна показати` : copy.title}
			effect={copy.description ?? "Спробуйте ще раз трохи згодом."}
			chip={<DataChip tone="muted">Не вдалося показати</DataChip>}
			action={
				copy.retry ? (
					<Button size="lg" variant="outline" onClick={onRetry}>
						Спробувати знову
					</Button>
				) : undefined
			}
		/>
	);
}

export function LineSkeleton() {
	return (
		<li className="px-4 py-5 sm:px-6" aria-busy="true">
			<Skeleton className="h-6 w-2/3" />
			<Skeleton className="mt-2 h-4 w-1/2" />
		</li>
	);
}

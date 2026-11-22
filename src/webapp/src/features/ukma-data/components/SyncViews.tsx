import { useQueryStates } from "nuqs";

import { Button } from "@/components/ui/Button";
import type { SyncSummary } from "@/lib/api/generated";
import type { ConfirmRequest } from "../syncConfirm";
import { formatCount } from "../syncFormat";
import { blankTitle, fieldLabel } from "../syncFields";
import { linkParts, partsTotal } from "../syncGroups";
import { viewParams } from "../syncParams";
import { linksRequest } from "../syncRequests";
import { SyncChangeList } from "./SyncChangeList";
import { SyncFieldsView } from "./SyncFieldsView";
import { SyncMergeDesk } from "./SyncMergeDesk";
import { SyncNewList } from "./SyncNewList";
import { SyncPairsList } from "./SyncPairsList";
import { SyncPlaceDesk } from "./SyncPlaceDesk";

export function SyncViews({
	summary,
	onBack,
	onConfirm,
}: Readonly<{
	summary: SyncSummary;
	onBack: () => void;
	onConfirm: (request: ConfirmRequest) => void;
}>) {
	const [params, setParams] = useQueryStates(viewParams);
	const { groups } = summary;
	if (params.view === "links") {
		return (
			<SyncChangeList
				title="Ті самі, що в САЗ"
				description="Ці дисципліни, семестри, факультети й кафедри вже є на сайті. Підтвердження лише запам'ятовує, що це одне й те саме; на сайті нічого не зміниться."
				scope={{ group: "link", field: null, blanks: null }}
				onBack={onBack}
				action={
					<Button
						size="lg"
						className="w-full sm:w-auto"
						onClick={() => onConfirm(linksRequest(groups))}
					>
						Підтвердити всі {formatCount(partsTotal(linkParts(groups)))}
					</Button>
				}
			/>
		);
	}
	if (params.view === "new") {
		return (
			<SyncNewList groups={groups} onBack={onBack} onConfirm={onConfirm} />
		);
	}
	if (params.view === "fields" && params.field !== null) {
		const blanks = params.blanks === true;
		return (
			<SyncChangeList
				title={blanks ? blankTitle(params.field) : fieldLabel(params.field)}
				description="Семестри, у яких САЗ змінив це поле. Оцінки ці зміни не зачіпають."
				scope={{ group: "change", field: params.field, blanks }}
				onBack={() =>
					void setParams({ field: null, blanks: null, q: null, page: null })
				}
			/>
		);
	}
	if (params.view === "fields") {
		return (
			<SyncFieldsView
				changes={groups.changes}
				onBack={onBack}
				onOpen={(field, blanks) => void setParams({ field, blanks })}
				onConfirm={onConfirm}
			/>
		);
	}
	if (params.view === "merge") {
		return <SyncMergeDesk onBack={onBack} onConfirm={onConfirm} />;
	}
	if (params.view === "pairs") {
		return <SyncPairsList onBack={onBack} onConfirm={onConfirm} />;
	}
	if (params.view === "place") {
		return <SyncPlaceDesk onBack={onBack} onConfirm={onConfirm} />;
	}
	return null;
}

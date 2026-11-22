import { DataExplainer } from "./DataExplainer";

export const CASE_EXPLAINER_KEY = "rate-ukma:case-explainer-seen";

export function CaseExplainer() {
	return (
		<DataExplainer
			title="Що це?"
			hint="звідки беруться справи і що діє, поки їх не вирішено"
			storageKey={CASE_EXPLAINER_KEY}
		>
			<p>
				Справа — питання, яке не вдалося вирішити автоматично під час нічного
				читання САЗ. Наприклад, новий запис студента схожий на кількох наявних,
				або САЗ раптом перестала показувати багато семестрів.
			</p>
			<p>
				<strong>Поки справу не вирішено, діє безпечна відповідь</strong>:
				варіант, який нічого не ламає і який легко змінити. Кожна справа пише,
				яка саме.
			</p>
			<p>Рішення ухвалюють у САЗ-даних; тут — перегляд.</p>
		</DataExplainer>
	);
}

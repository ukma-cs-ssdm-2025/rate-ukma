import type { UkmaDataStatus } from "@/lib/api/generated";
import { missingScopes } from "../keyScopes";
import { Ago } from "./Term";

export function OverviewTech({ status }: Readonly<{ status: UkmaDataStatus }>) {
	const missing = missingScopes(status.scopes);
	return (
		<details className="text-sm text-muted-foreground">
			<summary className="cursor-pointer">Технічні деталі</summary>
			<dl className="mt-2 grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1">
				<dt>Ключ доступу</dt>
				<dd className="min-w-0 font-mono text-xs break-all">{status.key_id}</dd>
				<dt>Діє до</dt>
				<dd>
					<Ago iso={status.key_expires_at} />
				</dd>
				<dt>Права</dt>
				<dd className="min-w-0 font-mono text-xs break-all">
					{status.scopes.length > 0 ? status.scopes.join(", ") : "—"}
				</dd>
			</dl>
			{missing.length > 0 ? (
				<ul className="mt-2 space-y-1">
					{missing.map((need) => (
						<li key={need.scope}>
							Ключ не має права {need.scope}, тому {need.area} тут не показано.
						</li>
					))}
				</ul>
			) : null}
		</details>
	);
}

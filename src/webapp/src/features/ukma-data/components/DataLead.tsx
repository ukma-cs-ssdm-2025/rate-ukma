import { formatCount } from "../syncFormat";

export function DataLead({
	title,
	subtitle,
	remaining,
}: Readonly<{
	title: string;
	subtitle: string | null;
	remaining?: number;
}>) {
	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
			<div className="space-y-1">
				<h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
				{subtitle ? (
					<p className="text-sm text-muted-foreground">{subtitle}</p>
				) : null}
			</div>
			{remaining === undefined ? null : (
				<p className="text-sm text-muted-foreground">
					Залишилось вирішити{" "}
					<span className="ml-1 text-2xl font-semibold text-foreground tabular-nums">
						{formatCount(remaining)}
					</span>
				</p>
			)}
		</div>
	);
}

import { testIds } from "@/lib/test-ids";

const repoUrl = "https://github.com/ukma-cs-ssdm-2025/rate-ukma";

export default function Footer() {
	const year = new Date().getFullYear();

	return (
		<footer className="mt-auto border-t border-border/40 bg-background">
			<div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-2 px-6 py-5 sm:flex-row sm:justify-between">
				<p className="text-sm text-muted-foreground">{`© ${year} Rate UKMA`}</p>

				<a
					href={repoUrl}
					target="_blank"
					rel="noreferrer"
					className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
					data-testid={testIds.footer.repoLink}
				>
					GitHub репозиторій
				</a>
			</div>
		</footer>
	);
}

import { Github, Heart } from "lucide-react";

import { testIds } from "@/lib/test-ids";

const repoUrl = "https://github.com/ukma-cs-ssdm-2025/rate-ukma";

export default function Footer() {
	const year = new Date().getFullYear();

	return (
		<footer className="mt-auto border-t border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
			<div className="container mx-auto px-6 max-w-7xl flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
				<p className="text-sm text-muted-foreground text-center md:text-left">
					<span>{`© ${year} Rate UKMA. Зроблено студентами НаУКМА `}</span>
					<Heart
						className="inline-block h-4 w-4 text-primary align-[-2px]"
						fill="currentColor"
						aria-hidden="true"
					/>
				</p>

				<a
					href={repoUrl}
					target="_blank"
					rel="noreferrer"
					className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground md:justify-end"
					data-testid={testIds.footer.repoLink}
				>
					<Github className="h-4 w-4" aria-hidden="true" />
					<span>GitHub репозиторій</span>
				</a>
			</div>
		</footer>
	);
}

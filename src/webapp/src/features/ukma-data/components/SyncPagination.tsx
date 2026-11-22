import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/Button";

interface SyncPaginationProps {
	page: number;
	totalPages: number;
	nextPage: number | null;
	previousPage: number | null;
	onPageChange: (page: number) => void;
}

export function SyncPagination({
	page,
	totalPages,
	nextPage,
	previousPage,
	onPageChange,
}: Readonly<SyncPaginationProps>) {
	return (
		<div className="flex items-center justify-between gap-2 text-sm">
			<Button
				variant="outline"
				size="sm"
				disabled={previousPage === null}
				onClick={() => onPageChange(previousPage ?? page - 1)}
			>
				<ChevronLeft />
				Назад
			</Button>
			<span className="text-muted-foreground">
				Сторінка {page} з {Math.max(totalPages, 1)}
			</span>
			<Button
				variant="outline"
				size="sm"
				disabled={nextPage === null}
				onClick={() => onPageChange(nextPage ?? page + 1)}
			>
				Далі
				<ChevronRight />
			</Button>
		</div>
	);
}

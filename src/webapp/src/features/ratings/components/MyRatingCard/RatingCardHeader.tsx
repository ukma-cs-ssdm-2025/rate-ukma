import { Link } from "@tanstack/react-router";
import { Pencil, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CardHeader, CardTitle } from "@/components/ui/Card";

interface RatingCardHeaderProps {
	courseTitle?: string;
	courseCode?: string;
	courseId?: string;
	canModify: boolean;
	isEditing: boolean;
	disableActions: boolean;
	onEditToggle: () => void;
	onDelete?: () => void;
}

export function RatingCardHeader({
	courseTitle,
	courseCode,
	courseId,
	canModify,
	isEditing,
	disableActions,
	onEditToggle,
	onDelete,
}: Readonly<RatingCardHeaderProps>) {
	return (
		<CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex flex-wrap items-center gap-2">
				<CardTitle className="text-base font-semibold">
					{courseId ? (
						<Link
							to="/courses/$courseId"
							params={{ courseId }}
							className="hover:underline decoration-dotted underline-offset-4"
						>
							{courseTitle ?? "Курс"}
						</Link>
					) : (
						(courseTitle ?? "Курс")
					)}
				</CardTitle>
				{courseCode ? (
					<Badge
						variant="outline"
						className="border px-2 py-0.5 text-[11px] uppercase tracking-wide"
					>
						{courseCode}
					</Badge>
				) : null}
			</div>
			{canModify ? (
				<div className="flex items-center gap-2">
					<Button
						size="sm"
						variant={isEditing ? "secondary" : "outline"}
						onClick={onEditToggle}
						disabled={disableActions}
						aria-label={
							isEditing ? "Скасувати редагування" : "Редагувати оцінку"
						}
					>
						{isEditing ? (
							<X className="h-3.5 w-3.5" />
						) : (
							<Pencil className="h-3.5 w-3.5" />
						)}
					</Button>
					<Button
						size="sm"
						variant="outline"
						className="text-destructive hover:bg-destructive/10 hover:text-destructive"
						onClick={() => onDelete?.()}
						disabled={disableActions}
						aria-label="Видалити оцінку"
					>
						<Trash2 className="h-3.5 w-3.5" />
					</Button>
				</div>
			) : null}
		</CardHeader>
	);
}

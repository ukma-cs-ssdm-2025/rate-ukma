import { useId, useState } from "react";
import type { FormEvent } from "react";

import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";

import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Label } from "@/components/ui/Label";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "@/components/ui/Toaster";
import { formatDate } from "@/features/courses/courseFormatting";
import {
	ANONYMOUS_COMMENT_NAME,
	DEFAULT_STUDENT_NAME,
} from "@/features/ratings/definitions/ratingDefinitions";
import type { CommentAuthor, CommentRead } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";

export interface CommentFormValues {
	readonly content: string;
	readonly isAnonymous: boolean;
}

interface CommentFormProps {
	readonly placeholder: string;
	readonly submitLabel: string;
	readonly initialContent?: string;
	readonly initialAnonymous?: boolean;
	readonly isSubmitting?: boolean;
	readonly onSubmit: (values: CommentFormValues) => Promise<void>;
	readonly onCancel?: () => void;
	readonly autoFocus?: boolean;
}
interface CommentActionsProps {
	readonly comment: CommentRead;
	readonly onEdit: () => void;
	readonly onDelete: () => void;
}

type CommentPreviewAuthor = CommentAuthor;
function getAuthorName(author: {
	readonly is_anonymous?: boolean;
	readonly user_name?: string | null;
}) {
	if (author.is_anonymous) {
		return ANONYMOUS_COMMENT_NAME;
	}
	return author.user_name || DEFAULT_STUDENT_NAME;
}

function getCommentAuthor(comment: CommentRead) {
	return getAuthorName(comment);
}

export function formatCount(value: number | undefined): string {
	return new Intl.NumberFormat("uk-UA").format(value ?? 0);
}

function formatReply(value: number): string {
	const lastDigit = value % 10;
	const lastTwoDigits = value % 100;

	if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
		return "відповідей";
	}

	if (lastDigit === 1) {
		return "відповідь";
	}

	if (lastDigit >= 2 && lastDigit <= 4) {
		return "відповіді";
	}

	return "відповідей";
}

export function CommentForm({
	placeholder,
	submitLabel,
	initialContent = "",
	initialAnonymous = false,
	isSubmitting = false,
	onSubmit,
	onCancel,
	autoFocus = false,
}: CommentFormProps) {
	const anonymousId = useId();
	const [content, setContent] = useState(initialContent);
	const [isAnonymous, setIsAnonymous] = useState(initialAnonymous);
	const trimmedContent = content.trim();

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!trimmedContent || isSubmitting) {
			return;
		}

		try {
			await onSubmit({
				content: trimmedContent,
				isAnonymous,
			});
		} catch (error) {
			console.error("Failed to save comment:", error);
			toast.error("Не вдалося зберегти коментар. Спробуйте ще раз");
			return;
		}

		if (!initialContent) {
			setContent("");
			setIsAnonymous(false);
		}
	};

	return (
		<form
			className="space-y-2"
			onSubmit={handleSubmit}
			data-testid={testIds.comments.form}
		>
			<Textarea
				value={content}
				onChange={(event) => setContent(event.target.value)}
				placeholder={placeholder}
				autoFocus={autoFocus}
				rows={3}
				className="min-h-20 resize-y text-sm"
				maxLength={2000}
				data-testid={testIds.comments.textarea}
			/>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<Label
					htmlFor={anonymousId}
					className="cursor-pointer text-xs text-muted-foreground"
				>
					<Checkbox
						id={anonymousId}
						checked={isAnonymous}
						onCheckedChange={(checked) => setIsAnonymous(checked === true)}
						data-testid={testIds.comments.anonymousCheckbox}
					/>
					Анонімно
				</Label>
				<div className="flex items-center justify-end gap-2">
					{onCancel && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={onCancel}
							disabled={isSubmitting}
						>
							Скасувати
						</Button>
					)}
					<Button
						type="submit"
						size="sm"
						disabled={!trimmedContent || isSubmitting}
						data-testid={testIds.comments.submitButton}
					>
						{isSubmitting && <Spinner className="size-3.5" />}
						{submitLabel}
					</Button>
				</div>
			</div>
		</form>
	);
}

export function CommentActions({
	comment,
	onEdit,
	onDelete,
}: CommentActionsProps) {
	const isOwner = comment.can_manage;

	if (!isOwner) {
		return null;
	}

	return (
		<div className="flex shrink-0 items-center gap-1">
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="size-7"
				onClick={onEdit}
				aria-label="Редагувати коментар"
				data-testid={testIds.comments.editButton}
			>
				<Pencil className="size-3.5" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
				onClick={onDelete}
				aria-label="Видалити коментар"
				data-testid={testIds.comments.deleteButton}
			>
				<Trash2 className="size-3.5" />
			</Button>
		</div>
	);
}

export function CommentBody({ comment }: Readonly<{ comment: CommentRead }>) {
	const author = getCommentAuthor(comment);

	return (
		<div className="min-w-0 flex-1">
			<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
				<span className="min-w-0 truncate text-sm font-medium">{author}</span>
				{comment.created_at && (
					<time className="text-xs text-muted-foreground">
						{formatDate(comment.created_at)}
					</time>
				)}
			</div>
			<p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
				{comment.content}
			</p>
		</div>
	);
}

export function CommentAvatar({ comment }: Readonly<{ comment: CommentRead }>) {
	return (
		<UserAvatar
			name={getCommentAuthor(comment)}
			avatarUrl={comment.user_avatar_url}
			isAnonymous={comment.is_anonymous ?? false}
			className="size-7 shrink-0 text-xs font-semibold"
		/>
	);
}

function PreviewAuthorAvatar({
	author,
	index,
}: Readonly<{
	author: CommentPreviewAuthor;
	index: number;
}>) {
	return (
		<span
			className={cn(
				"relative flex size-6 shrink-0 rounded-full",
				index > 0 && "-ml-2 ring-2 ring-background",
			)}
		>
			<UserAvatar
				name={getAuthorName(author)}
				avatarUrl={author.user_avatar_url}
				isAnonymous={author.is_anonymous ?? false}
				className="relative size-full text-xs font-semibold"
			/>
		</span>
	);
}

export function CommentAuthorsPreview({
	authors,
}: Readonly<{
	authors?: readonly CommentAuthor[];
}>) {
	const previewAuthors = authors?.length ? authors.slice(0, 3).reverse() : [];

	if (previewAuthors.length === 0) {
		return null;
	}

	return (
		<span className="flex items-center" aria-hidden="true">
			{previewAuthors.map((author, index) => (
				<PreviewAuthorAvatar
					key={`${author.user_id ?? "anonymous"}-${index}`}
					author={author}
					index={index}
				/>
			))}
		</span>
	);
}

export function RepliesPreview({
	comment,
	showReplies,
	onToggle,
}: Readonly<{
	comment: CommentRead;
	showReplies: boolean;
	onToggle: () => void;
}>) {
	const replyCount = comment.replies_count ?? 0;

	if (replyCount === 0) {
		return null;
	}

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className="h-7 gap-2 px-1.5 text-xs text-muted-foreground"
			onClick={onToggle}
			aria-expanded={showReplies}
		>
			<span className="font-semibold text-primary">
				{formatCount(replyCount)} {formatReply(replyCount)}
			</span>
			{showReplies ? (
				<ChevronUp className="size-3.5" />
			) : (
				<ChevronDown className="size-3.5" />
			)}
		</Button>
	);
}

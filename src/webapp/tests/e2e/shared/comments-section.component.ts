import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { testIds } from "@/lib/test-ids";

const REPLY_BUTTON_NAME = /Відповісти/u;

interface SubmitCommentOptions {
	readonly anonymous?: boolean;
}

type CommentItemOccurrence = "first" | "last";

export class CommentsSection {
	private readonly root: Locator;
	private readonly toggleButton: Locator;
	private readonly deleteDialog: Locator;
	private readonly deleteCancelButton: Locator;
	private readonly deleteConfirmButton: Locator;

	constructor(page: Page, root?: Locator) {
		this.root = root ?? page.locator("body");
		this.toggleButton = this.root.getByTestId(testIds.comments.toggleButton);
		this.deleteDialog = page.getByTestId(testIds.deleteDialog.root);
		this.deleteCancelButton = page.getByTestId(
			testIds.deleteDialog.cancelButton,
		);
		this.deleteConfirmButton = page.getByTestId(
			testIds.deleteDialog.confirmButton,
		);
	}

	async toggle(): Promise<void> {
		await expect(this.toggleButton).toBeVisible();
		await this.toggleButton.click();
	}

	async expand(): Promise<void> {
		await expect(this.toggleButton).toBeVisible();
		if ((await this.toggleButton.getAttribute("aria-expanded")) !== "true") {
			await this.toggleButton.click();
		}
	}

	async startComment(): Promise<void> {
		const startButton = this.root
			.getByRole("button", { name: REPLY_BUTTON_NAME })
			.first();
		await expect(startButton).toBeVisible();
		await startButton.click();
		await expect(this.visibleForm()).toBeVisible();
	}

	async createComment(
		content: string,
		options?: SubmitCommentOptions,
	): Promise<void> {
		await this.startComment();
		await this.submitForm(this.visibleForm(), content, options);
		await this.expectCommentVisible(content);
	}

	async replyToComment(
		parentContent: string,
		replyContent: string,
		options?: SubmitCommentOptions,
	): Promise<void> {
		const parentItem = this.commentItemByText(parentContent);
		await expect(parentItem).toBeVisible();

		const replyButton = this.commentControls(parentItem)
			.getByRole("button", { name: REPLY_BUTTON_NAME })
			.last();
		await expect(replyButton).toBeVisible();
		await replyButton.click();

		await this.submitForm(this.visibleForm(), replyContent, options);
		await this.expectCommentVisible(replyContent, "last");
		await expect(this.repliesToggle(parentItem)).toBeVisible();
	}

	async expandReplies(parentContent: string): Promise<void> {
		const parentItem = this.commentItemByText(parentContent);
		await expect(parentItem).toBeVisible();

		const repliesToggle = this.repliesToggle(parentItem);
		await expect(repliesToggle).toBeVisible();

		if ((await repliesToggle.getAttribute("aria-expanded")) !== "true") {
			await repliesToggle.click();
		}
	}

	async editComment(
		currentContent: string,
		updatedContent: string,
		options?: SubmitCommentOptions,
	): Promise<void> {
		const commentItem = this.commentItemByText(currentContent);
		await expect(commentItem).toBeVisible();

		const editButton = commentItem.getByTestId(testIds.comments.editButton);
		await expect(editButton).toBeVisible();
		await editButton.click();

		const editForm = this.visibleForm();
		await expect(editForm.getByTestId(testIds.comments.textarea)).toHaveValue(
			currentContent,
		);
		await this.submitForm(editForm, updatedContent, options);
		await this.expectCommentVisible(updatedContent);
	}

	async requestDeleteComment(content: string): Promise<void> {
		const commentItem = this.commentItemByText(content);
		await expect(commentItem).toBeVisible();

		const deleteButton = commentItem.getByTestId(testIds.comments.deleteButton);
		await expect(deleteButton).toBeVisible();
		await deleteButton.click();
		await expect(this.deleteDialog).toBeVisible();
	}

	async cancelDelete(): Promise<void> {
		await expect(this.deleteCancelButton).toBeVisible();
		await this.deleteCancelButton.click();
		await expect(this.deleteDialog).toBeHidden();
	}

	async confirmDelete(): Promise<void> {
		await expect(this.deleteConfirmButton).toBeVisible();
		await this.deleteConfirmButton.click();
		await expect(this.deleteDialog).toBeHidden();
	}

	async deleteComment(content: string): Promise<void> {
		await this.requestDeleteComment(content);
		await this.confirmDelete();
		await this.expectCommentHidden(content);
	}

	commentItemByText(
		content: string,
		occurrence: CommentItemOccurrence = "first",
	): Locator {
		const items = this.root
			.getByTestId(testIds.comments.item)
			.filter({ hasText: content });
		return occurrence === "last" ? items.last() : items.first();
	}

	async expectCommentVisible(
		content: string,
		occurrence?: CommentItemOccurrence,
	): Promise<Locator> {
		const commentItem = this.commentItemByText(content, occurrence);
		await expect(commentItem).toBeVisible();
		return commentItem;
	}

	async expectCommentHidden(content: string): Promise<void> {
		await expect(this.commentItemByText(content)).toBeHidden();
	}

	async expectManagementActionsHidden(content: string): Promise<void> {
		const commentItem = await this.expectCommentVisible(content);
		await expect(
			commentItem.getByTestId(testIds.comments.editButton),
		).toHaveCount(0);
		await expect(
			commentItem.getByTestId(testIds.comments.deleteButton),
		).toHaveCount(0);
	}

	private commentControls(commentItem: Locator): Locator {
		return commentItem.getByTestId(testIds.comments.controls).first();
	}

	private repliesToggle(commentItem: Locator): Locator {
		return this.commentControls(commentItem)
			.locator("button[aria-expanded]")
			.first();
	}

	private visibleForm(): Locator {
		return this.root
			.getByTestId(testIds.comments.form)
			.filter({ visible: true });
	}

	private async submitForm(
		form: Locator,
		content: string,
		options?: SubmitCommentOptions,
	): Promise<void> {
		const textarea = form.getByTestId(testIds.comments.textarea);
		await expect(textarea).toBeVisible();
		await textarea.fill(content);

		if (options?.anonymous) {
			const anonymousCheckbox = form.getByTestId(
				testIds.comments.anonymousCheckbox,
			);
			await expect(anonymousCheckbox).toBeVisible();
			if ((await anonymousCheckbox.getAttribute("data-state")) !== "checked") {
				await anonymousCheckbox.click();
			}
		}

		const submitButton = form.getByTestId(testIds.comments.submitButton);
		await expect(submitButton).toBeEnabled();
		await submitButton.click();
	}
}

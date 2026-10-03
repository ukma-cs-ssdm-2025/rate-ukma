import type { Components } from "react-markdown";
import type React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

interface MarkdownProps extends React.HTMLAttributes<HTMLDivElement> {
	readonly children: string;
}

/**
 * Styled per element rather than via a typography plugin so the output uses
 * the same tokens as the rest of the UI. Raw HTML in the source is not
 * rendered (react-markdown's default), so admin-authored content stays safe.
 */
const components: Components = {
	h1: ({ node: _node, className, ...props }) => (
		<h2
			className={cn(
				"mt-4 text-lg font-semibold tracking-tight first:mt-0",
				className,
			)}
			{...props}
		/>
	),
	h2: ({ node: _node, className, ...props }) => (
		<h3
			className={cn(
				"mt-4 text-base font-semibold tracking-tight first:mt-0",
				className,
			)}
			{...props}
		/>
	),
	h3: ({ node: _node, className, ...props }) => (
		<h4 className={cn("mt-3 font-semibold first:mt-0", className)} {...props} />
	),
	p: ({ node: _node, className, ...props }) => (
		<p className={cn("mt-3 first:mt-0", className)} {...props} />
	),
	a: ({ node: _node, className, ...props }) => (
		<a
			className={cn(
				"font-medium text-primary underline underline-offset-4",
				className,
			)}
			target="_blank"
			rel="noopener noreferrer"
			{...props}
		/>
	),
	ul: ({ node: _node, className, ...props }) => (
		<ul
			className={cn("mt-3 list-disc space-y-1 pl-5 first:mt-0", className)}
			{...props}
		/>
	),
	ol: ({ node: _node, className, ...props }) => (
		<ol
			className={cn("mt-3 list-decimal space-y-1 pl-5 first:mt-0", className)}
			{...props}
		/>
	),
	blockquote: ({ node: _node, className, ...props }) => (
		<blockquote
			className={cn(
				"mt-3 border-l-2 border-border pl-3 italic text-muted-foreground",
				className,
			)}
			{...props}
		/>
	),
	code: ({ node: _node, className, ...props }) => (
		<code
			className={cn(
				"rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]",
				className,
			)}
			{...props}
		/>
	),
	pre: ({ node: _node, className, ...props }) => (
		<pre
			className={cn(
				"mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs",
				className,
			)}
			{...props}
		/>
	),
	hr: ({ node: _node, className, ...props }) => (
		<hr className={cn("my-4 border-border", className)} {...props} />
	),
	img: ({ node: _node, className, ...props }) => (
		<img
			className={cn("mt-3 max-w-full rounded-lg", className)}
			loading="lazy"
			{...props}
		/>
	),
	table: ({ node: _node, className, ...props }) => (
		<div className="mt-3 overflow-x-auto">
			<table className={cn("w-full text-left text-sm", className)} {...props} />
		</div>
	),
	th: ({ node: _node, className, ...props }) => (
		<th
			className={cn(
				"border-b border-border px-2 py-1 font-semibold",
				className,
			)}
			{...props}
		/>
	),
	td: ({ node: _node, className, ...props }) => (
		<td
			className={cn("border-b border-border px-2 py-1", className)}
			{...props}
		/>
	),
};

export function Markdown({ children, className, ...props }: MarkdownProps) {
	return (
		<div className={className} {...props}>
			<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
				{children}
			</ReactMarkdown>
		</div>
	);
}

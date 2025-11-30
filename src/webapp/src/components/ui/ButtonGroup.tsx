import type { ReactElement, ReactNode } from "react";
import {
	Children,
	cloneElement,
	createContext,
	isValidElement,
	useContext,
} from "react";

import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

type ButtonGroupOrientation = "horizontal" | "vertical";

const ButtonGroupContext = createContext<ButtonGroupOrientation>("horizontal");

function isButtonElement(child: ReactNode): child is ReactElement<{
	className?: string;
	"data-slot"?: string;
}> {
	return (
		isValidElement(child) &&
		typeof child.props === "object" &&
		child.props !== null &&
		"data-slot" in child.props &&
		child.props["data-slot"] === "button"
	);
}

function ButtonGroup({
	className,
	children,
	orientation = "horizontal",
	...props
}: Readonly<
	React.ComponentProps<"div"> & { orientation?: ButtonGroupOrientation }
>) {
	const childrenArray = Children.toArray(children);
	const buttonIndexes = childrenArray.reduce<number[]>((acc, child, index) => {
		if (isButtonElement(child)) {
			acc.push(index);
		}
		return acc;
	}, []);

	const enhancedChildren = childrenArray.map((child, index) => {
		if (!isButtonElement(child)) return child;

		const position = buttonIndexes.indexOf(index);
		const isFirst = position === 0;
		const isLast = position === buttonIndexes.length - 1;

		const roundedClasses =
			orientation === "vertical"
				? cn(
						"rounded-none",
						isFirst && "rounded-t-md",
						isLast && "rounded-b-md",
					)
				: cn(
						"rounded-none",
						isFirst && "rounded-l-md",
						isLast && "rounded-r-md",
					);

		return cloneElement(child, {
			className: cn(child.props.className, roundedClasses),
		});
	});

	return (
		<ButtonGroupContext.Provider value={orientation}>
			{/* biome-ignore lint/a11y/useSemanticElements: role="group" is correct for button groups; fieldset is for form controls */}
			<div
				role="group"
				data-slot="button-group"
				data-orientation={orientation}
				className={cn(
					"inline-flex w-fit items-stretch rounded-md border bg-card text-sm shadow-xs",
					orientation === "vertical" ? "flex-col" : "flex-row",
					className,
				)}
				{...props}
			>
				{enhancedChildren}
			</div>
		</ButtonGroupContext.Provider>
	);
}
function ButtonGroupSeparator({
	className,
	orientation,
	...props
}: Readonly<
	React.ComponentProps<"div"> & { orientation?: ButtonGroupOrientation }
>) {
	const contextOrientation = useContext(ButtonGroupContext);
	const resolvedOrientation =
		orientation ??
		(contextOrientation === "vertical" ? "horizontal" : "vertical");

	const isVertical = resolvedOrientation === "vertical";

	return (
		<div
			aria-hidden="true"
			data-slot="button-group-separator"
			data-orientation={resolvedOrientation}
			className={cn(
				"bg-border",
				isVertical ? "h-full w-px" : "h-px w-full",
				className,
			)}
			{...props}
		/>
	);
}

function ButtonGroupText({
	asChild = false,
	className,
	...props
}: Readonly<React.ComponentProps<"span"> & { asChild?: boolean }>) {
	const orientation = useContext(ButtonGroupContext);
	const Comp = asChild ? Slot : "span";

	return (
		<Comp
			data-slot="button-group-text"
			className={cn(
				"inline-flex items-center px-3 text-sm font-medium text-muted-foreground",
				orientation === "vertical" ? "py-2" : "py-1.5",
				className,
			)}
			{...props}
		/>
	);
}

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText };

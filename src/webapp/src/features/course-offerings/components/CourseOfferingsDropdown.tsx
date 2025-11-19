import { useEffect, useRef, useState } from "react";

import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

import type { CourseOffering } from "@/lib/api/generated";

const BASE_EXTERNAL_URL = "https://my.ukma.edu.ua/course/";

interface CourseOfferingsDropdownProps {
	courseOfferings: CourseOffering[];
}

export function CourseOfferingsDropdown({
	courseOfferings,
}: CourseOfferingsDropdownProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			document.addEventListener("keydown", handleEscape);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isOpen]);

	const handleButtonBlur = () => {
		// Small delay to allow focus to move to dropdown items
		setTimeout(() => {
			if (
				containerRef.current &&
				!containerRef.current.contains(document.activeElement)
			) {
				setIsOpen(false);
			}
		}, 100);
	};

	if (!courseOfferings || courseOfferings.length === 0) return null;

	return (
		<div ref={containerRef} className="relative inline-block">
			<button
				onClick={() => setIsOpen(!isOpen)}
				onBlur={handleButtonBlur}
				className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none"
				type="button"
			>
				Курси на САЗ
				{isOpen && <ChevronUp className="h-4 w-4" />}
				{!isOpen && <ChevronDown className="h-4 w-4" />}
			</button>

			{isOpen && (
				<div className="absolute right-0 mt-4 w-max max-w-md rounded-md bg-white shadow-lg ring-1 ring-gray-200 focus:outline-none transition-all duration-200 ease-out animate-in fade-in-0 zoom-in-95">
					<div className="py-1">
						{courseOfferings.map((offering) => (
							<a
								key={offering.id}
								href={`${BASE_EXTERNAL_URL}${offering.code}`}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
							>
								<span>
									{offering.course_title} - {offering.semester_term}{" "}
									{offering.semester_year}
								</span>
								<ExternalLink className="ml-3 h-4 w-4 text-gray-500" />
							</a>
						))}
						{courseOfferings.map((offering) => (
							<a
								key={offering.id}
								href={`${BASE_EXTERNAL_URL}${offering.code}`}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
							>
								<span>
									Environmental Studies - {offering.semester_term} 2024
								</span>
								<ExternalLink className="ml-3 h-4 w-4 text-gray-500" />
							</a>
						))}
						{courseOfferings.map((offering) => (
							<a
								key={offering.id}
								href={`${BASE_EXTERNAL_URL}${offering.code}`}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
							>
								<span>
									Environmental Studies Old - {offering.semester_term} 2023
								</span>
								<ExternalLink className="ml-3 h-4 w-4 text-gray-500" />
							</a>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

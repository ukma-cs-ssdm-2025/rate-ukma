import type { ReactNode } from "react";
import Header from "./Header";

interface LayoutProps {
	children: ReactNode;
}

function Layout({ children }: LayoutProps) {
	return (
		<div className="min-h-screen bg-background">
			<Header />
			<main className="container mx-auto px-4 py-8">{children}</main>
		</div>
	);
}

export default Layout;

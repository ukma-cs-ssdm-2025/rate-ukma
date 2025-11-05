import type { ReactNode } from "react";

import Header from "./Header";

interface LayoutProps {
	children: ReactNode;
}

function Layout({ children }: Readonly<LayoutProps>) {
	return (
		<div className="min-h-screen bg-background">
			<Header />
			<main className="container mx-auto px-6 py-8 max-w-7xl">{children}</main>
		</div>
	);
}

export default Layout;

import type { ReactNode } from "react";

import Footer from "./Footer/Footer";
import Header from "./Header/Header";

interface LayoutProps {
	children: ReactNode;
}

function Layout({ children }: Readonly<LayoutProps>) {
	return (
		<div className="flex min-h-screen flex-col bg-background">
			<Header />
			<main className="container mx-auto px-6 py-8 max-w-7xl flex-1">
				{children}
			</main>
			<Footer />
		</div>
	);
}

export default Layout;

import type { ReactNode } from "react";

import Footer from "./Footer/Footer";
import Header from "./Header/Header";

interface LayoutProps {
	children: ReactNode;
	showFooter?: boolean;
}

function Layout({ children, showFooter = true }: Readonly<LayoutProps>) {
	return (
		<div className="flex min-h-screen flex-col bg-background">
			<Header />
			<main className="container mx-auto max-w-7xl flex-1 px-6 py-8">
				{children}
			</main>
			{showFooter ? <Footer /> : null}
		</div>
	);
}

export default Layout;

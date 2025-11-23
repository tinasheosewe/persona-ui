import type { Metadata } from "next";
import { MyRuntimeProvider } from "@/app/MyRuntimeProvider";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: "Chatbot UI",
  description: "Lightweight Next.js client for the FastAPI chatbot backend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <MyRuntimeProvider>
      <html lang="en" className="h-dvh">
        <body className="h-dvh bg-background font-sans text-foreground">
          <div className="flex h-full flex-col">
            <SiteHeader />
            <div className="flex-1 overflow-y-auto">{children}</div>
          </div>
        </body>
      </html>
    </MyRuntimeProvider>
  );
}

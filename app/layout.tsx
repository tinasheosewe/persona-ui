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
      <html lang="en" className="h-dvh overflow-hidden">
        <body className="h-dvh overflow-hidden bg-background font-sans text-foreground">
          <div className="flex h-full flex-col">
            <div className="flex-shrink-0">
              <SiteHeader />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
          </div>
        </body>
      </html>
    </MyRuntimeProvider>
  );
}

import type { Metadata } from "next";
import { MyRuntimeProvider } from "@/app/MyRuntimeProvider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Persona UI",
  description: "Next.js client for the Persona chatbot backend",
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
          <div className="h-full">{children}</div>
        </body>
      </html>
    </MyRuntimeProvider>
  );
}

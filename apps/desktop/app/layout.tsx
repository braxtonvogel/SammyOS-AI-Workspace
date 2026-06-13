// app/layout.tsx
// Root layout — wraps all pages with SammyShell EXCEPT /chat-float.
// The float window is a frameless Tauri WebviewWindow that draws its own chrome.
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import SammyShell from "@/components/layout/sammy-shell";
import ConditionalShell from "@/components/layout/conditional-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sammy OS",
  description: "AI-powered desktop workspace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-black text-white">
        <TooltipProvider>
          <ConditionalShell>{children}</ConditionalShell>
        </TooltipProvider>
      </body>
    </html>
  );
}
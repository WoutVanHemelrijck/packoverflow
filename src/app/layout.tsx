import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { JanitorProvider } from "@/lib/store";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Spotless",
  description: "Spotless cleans company knowledge into one ground truth and serves it to your AI assistants. Not one conflicting fact left.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <JanitorProvider>{children}</JanitorProvider>
      </body>
    </html>
  );
}

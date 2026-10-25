import type { Metadata } from "next";
import { Caveat, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "JobLoop | Print shop orders, in a better loop",
    template: "%s | JobLoop",
  },
  description:
    "Turn every print enquiry into a clear quote, trackable job and confident delivery.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${geist.variable} ${geistMono.variable} ${caveat.variable}`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

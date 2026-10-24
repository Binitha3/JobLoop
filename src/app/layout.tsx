import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

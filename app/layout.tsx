import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Planno - Scheduling Made Simple",
  description: "Create shareable scheduling links and manage your meetings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


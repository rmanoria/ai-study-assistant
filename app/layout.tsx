import type { Metadata } from "next";

import {
  Geist,
  Geist_Mono,
} from "next/font/google";

import "./globals.css";

import {
  ClerkProvider,
} from "@clerk/nextjs";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Study Assistant",
  description:
    "An AI-powered study assistant built with Next.js and AI integration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
  lang="en"
  className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
>
  <head>
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1"
    />
  </head>

  <body className="min-h-full flex flex-col bg-black text-white">
    {children}
  </body>
</html>
    </ClerkProvider>
  );
}
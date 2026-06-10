import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "StudyAI — Your Intelligent Study Companion",
  description: "AI-powered study workspace: smart chat, flashcards, quizzes, notes, document analysis, and study planner. Built for students who want to learn faster.",
  keywords: "AI tutor, study assistant, flashcards, quiz, notes, PDF summarizer",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} h-full antialiased`}>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
          <meta name="theme-color" content="#070711" />
        </head>
        <body className="min-h-full flex flex-col bg-[#070711] text-white">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MotionRoot } from "@/components/motion/MotionRoot";
import { Providers } from "@/components/Providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://ripple.vaibhav.quest"), // absolute URLs for the OG image and icons
  title: "Ripple",
  description: "Change one thing. See everyone it touches, and who hasn't been told.",
};

// Light only (v2, #227). Kit credits live in the sidebar footer and on /help.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers><MotionRoot>{children}</MotionRoot></Providers>
      </body>
    </html>
  );
}

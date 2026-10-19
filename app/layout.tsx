import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { Intro } from "@/components/brand/intro";
import "./globals.css";

const sans = Outfit({ subsets: ["latin"], display: "swap", variable: "--font-sans" });

const themeBoot = `(function(){try{var t=localStorage.getItem("vp-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t;}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Embee VP Portal",
  description: "Project tracking, timesheets, billing, and payments for Embee.",
  icons: {
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf5f1",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className={sans.variable}>
        <Intro />
        {children}
      </body>
    </html>
  );
}

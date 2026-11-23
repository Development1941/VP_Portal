import type { Metadata, Viewport } from "next";
import { Intro } from "@/components/brand/intro";
import { Toaster } from "@/components/toast";
import "./globals.css";

const themeBoot = `(function(){try{var t=localStorage.getItem("vp-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t;}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Embee Project Workspaces",
  description: "Embee Finance and Embee Finsoft project management workspaces.",
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
      <body>
        <Intro />
        {children}
        <Toaster />
      </body>
    </html>
  );
}

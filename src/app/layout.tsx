import type { Metadata, Viewport } from "next";
import { Inter, Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import VitalityBackdrop from "@/components/VitalityBackdrop";
import Toaster from "@/components/Toaster";
import ThemeSync from "@/components/ThemeSync";
import PageTransition from "@/components/motion/PageTransition";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Imperium",
  description: "Your personal training, nutrition, and vitals companion.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Imperium",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="mint"
      className={`${inter.variable} ${newsreader.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/* Apply the saved accent theme before first paint so returning users
            never see a flash of the default mint. Reads the localStorage copy
            the app keeps in sync; ThemeSync later reconciles with Supabase. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("imperium.theme");if(t==="blue"||t==="red"||t==="gold"||t==="mint"){document.documentElement.dataset.theme=t;}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <VitalityBackdrop />
        <ThemeSync />
        <main className="flex-1 pb-20">
          <PageTransition>{children}</PageTransition>
        </main>
        <BottomNav />
        <Toaster />
      </body>
    </html>
  );
}

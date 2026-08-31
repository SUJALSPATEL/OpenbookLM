import type { Metadata } from "next";
import { Archivo_Black, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

const archivo = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo",
  display: "swap",
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-spacemono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpenbookLM — chat with your sources",
  description:
    "Add a PDF, a link, a YouTube lecture, or your notes. Ask questions and get answers with citations you can open — or a plain “not in your sources” when it isn’t.",
  keywords: [
    "openbooklm",
    "notebooklm",
    "research",
    "grounded answers",
    "citation",
    "AI notebook",
  ],
};

const themeInit = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':false;document.documentElement.classList.toggle('dark',d);}catch(e){/* light by default */}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html 
      lang="en" 
      className={`${grotesk.variable} ${archivo.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        {/* the app ships its own light + dark themes (ThemeToggle), so
            auto-darkening extensions like Dark Reader must not re-theme it —
            double-darkening turns the cream text gray and the orange accent green */}
        <meta name="darkreader-lock" />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
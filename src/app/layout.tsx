import type { Metadata } from "next";
import { Geist_Mono, Inter, Poppins } from "next/font/google";
import "./globals.css";
import { BRAND_DESCRIPTION, BRAND_LOGO_PATH, BRAND_NAME } from "@/lib/brand";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const poppins = Poppins({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: BRAND_NAME,
    template: `%s · ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
  applicationName: BRAND_NAME,
  icons: {
    icon: BRAND_LOGO_PATH,
    apple: BRAND_LOGO_PATH,
  },
};

/** Always render on the server — pages query Turso/SQLite at request time. */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full flex-col overflow-hidden bg-[var(--background)] text-zinc-900">
        {children}
      </body>
    </html>
  );
}

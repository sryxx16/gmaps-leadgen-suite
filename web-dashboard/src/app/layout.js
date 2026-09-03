import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "GMaps Leads Dashboard",
  description: "Monitor and manage scraped data from Google Maps",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <div className="container">
          <nav className="navbar glass">
            <div className="nav-brand">LeadDash</div>
            <div className="nav-links">
              <a href="/">Dashboard</a>
              <a href="/import">Import Data</a>
            </div>
          </nav>
          <main>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

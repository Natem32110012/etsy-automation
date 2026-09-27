import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Compass, Factory, LayoutDashboard, Pin, Store } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Etsy Dijital Ürün Fabrikası",
  description: "Etsy dijital ürünleri ve Pinterest tanıtımları için üretim otomasyonu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen font-sans text-zinc-100 antialiased">
        <header className="border-b border-white/5">
          <nav className="mx-auto flex max-w-screen-2xl items-center gap-1 px-6 py-4">
            <span className="mr-4 text-xs font-medium tracking-[0.2em] text-violet-300/80">
              ETSY FABRİKA
            </span>
            <NavLink href="/" icon={<Factory className="size-4" />} label="Üretim" />
            <NavLink href="/discover" icon={<Compass className="size-4" />} label="Ideas" />
            <NavLink
              href="/dashboard"
              icon={<LayoutDashboard className="size-4" />}
              label="Dashboard"
            />
            <NavLink href="/etsy" icon={<Store className="size-4" />} label="Shop" />
            <NavLink href="/pins" icon={<Pin className="size-4" />} label="Pins" />
            <NavLink href="/analytics" icon={<BarChart3 className="size-4" />} label="Analytics" />
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}

function NavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
    >
      {icon}
      {label}
    </Link>
  );
}

import Link from "next/link";
import { primaryNav, moreNav } from "@/components/layout/nav-data";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Ellipsis } from "lucide-react";

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-slate-800 text-white"
          : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

function MobileNavLink({
  href,
  label,
  icon: Icon,
  isActive,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium",
        isActive ? "text-white" : "text-slate-400 hover:text-white"
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </Link>
  );
}

export function AppShell({ children, activePath }: { children: ReactNode; activePath: string }) {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col lg:flex-row">
        <aside className="hidden w-full max-w-[260px] flex-col border-r border-white/5 bg-[#111728] px-4 py-6 lg:flex">
          <div className="mb-8 px-2 text-left">
            <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
              Harmony Home
            </Link>
            <p className="mt-1 text-xs text-slate-400">A calmer household, at a glance.</p>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {primaryNav.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.name}
                icon={item.icon}
                isActive={activePath.startsWith(item.href)}
              />
            ))}
          </nav>
          <div className="mt-8 rounded-xl border border-white/5 bg-[#0d121f] p-3">
            <p className="text-xs text-slate-400">More</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              {moreNav.slice(0, 4).map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-white/5 hover:text-slate-100"
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.name}
                  </Link>
                </li>
              ))}
              <li>
                <MoreDesktop />
              </li>
            </ul>
          </div>
          <div className="mt-6 rounded-xl border border-white/5 bg-[#0d121f] px-3 py-2 text-xs text-slate-500">
            Account controls remain available from the header in upcoming iterations.
          </div>
        </aside>

        <main className="flex-1 pb-20 lg:pb-6">
          <div className="flex flex-col lg:min-h-screen lg:px-8 lg:py-8">
            {children}
          </div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 flex items-center justify-between border-t border-white/5 bg-[#111728]/95 px-3 py-2 backdrop-blur lg:hidden">
          {primaryNav.map((item) => (
            <MobileNavLink
              key={item.href}
              href={item.href}
              label={item.name}
              icon={item.icon}
              isActive={activePath.startsWith(item.href)}
            />
          ))}
          <MobileMore activePath={activePath} />
        </nav>
      </div>
    </div>
  );
}

function MoreDesktop() {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Link
          href="/more"
          className="w-full justify-start gap-2 px-3 py-2 text-left text-xs text-slate-400"
        >
          <Ellipsis className="h-3.5 w-3.5" /> More links
        </Link>
      </DrawerTrigger>
      <DrawerContent className="bg-[#0b0f19] text-slate-100">
        <DrawerHeader>
          <h3 className="text-sm font-semibold">More</h3>
          <p className="text-xs text-slate-400">Secondary modules and settings</p>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <div className="grid grid-cols-1 gap-2">
            {moreNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg border border-white/5 bg-[#111728] px-3 py-2 text-sm hover:border-white/10"
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </div>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Link
              href="/more"
              className="bg-white/10 text-slate-200 hover:bg-white/20"
            >
              Close
            </Link>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function MobileMore({ activePath }: { activePath: string }) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button className="flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-lg text-xs text-slate-400 transition hover:text-white">
          <Ellipsis className="h-6 w-6" />
          More
        </button>
      </DrawerTrigger>
      <DrawerContent className="bg-[#0b0f19] text-slate-100">
        <DrawerHeader>
          <h3 className="text-sm font-semibold">More</h3>
          <p className="text-xs text-slate-400">Secondary modules and settings</p>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <div className="grid grid-cols-1 gap-2">
            {moreNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-white/5 bg-[#111728] px-3 py-2 text-sm hover:border-white/10",
                  activePath === item.href && "border-white/20"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </div>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Link
              href="/more"
              className="bg-white/10 text-slate-200 hover:bg-white/20"
            >
              Close
            </Link>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

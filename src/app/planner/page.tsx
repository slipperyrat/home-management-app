import Link from "next/link";

export default function PlannerPage() {
  const quickLinks = [
    { href: "/planner/templates", label: "Templates" },
    { href: "/planner/goals", label: "Goals" },
    { href: "/automation", label: "Automations" },
    { href: "/reports", label: "Reports" },
  ];

  return (
    <div className="grid gap-6 px-4 py-6 lg:px-0">
      <section className="rounded-3xl bg-[#111728] p-6 shadow-lg shadow-black/20">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Planner</h1>
        <p className="mt-2 text-sm text-slate-400">
          Organize routines, task queues, and long-term goals. The revamped planner workspace will surface here shortly.
        </p>
      </section>
      <div className="grid gap-4 rounded-3xl border border-white/5 bg-[#101522] p-6 text-sm text-slate-400">
        <p>Planner boards are being redesigned. For now, explore related modules:</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0d121f] px-4 py-3 text-slate-200 transition hover:border-white/10 hover:text-white"
            >
              <span>{link.label}</span>
              <span aria-hidden>→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

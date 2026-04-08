import Link from "next/link";

const MAIN_ROUTES = [
  { href: "/totem", label: "Totem" },
  { href: "/painel-chamada", label: "Painel de chamada" },
  { href: "/atendente", label: "Atendente" },
  { href: "/medico", label: "Medico" },
  { href: "/admin", label: "Admin" }
] as const;

type MainRoutePath = (typeof MAIN_ROUTES)[number]["href"];

type MainTopNavProps = {
  readonly activePath: MainRoutePath;
  readonly showLogout?: boolean;
};

export function MainTopNav({ activePath, showLogout = false }: MainTopNavProps) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[2rem] border border-white/75 bg-white/88 p-3 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.22)] backdrop-blur-xl">
      <nav aria-label="Navegacao principal do sistema" className="min-w-0 flex-1 overflow-x-auto">
        <ul className="flex min-w-max gap-2">
          {MAIN_ROUTES.map((route) => {
            const isActive = route.href === activePath;
            return (
              <li key={route.href}>
                <Link
                  href={route.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center justify-center rounded-[1.1rem] border px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 ${
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.65)]"
                      : "border-white/80 bg-white/90 text-slate-700 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.18)] hover:border-sky-200 hover:bg-sky-50 hover:text-slate-900"
                  }`}
                >
                  {route.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {showLogout ? (
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-[1.1rem] border border-rose-600 bg-rose-600 px-4 text-sm font-black text-white shadow-[0_18px_34px_-24px_rgba(225,29,72,0.5)] transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
          >
            Sair
          </button>
        </form>
      ) : (
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center justify-center rounded-[1.1rem] border border-slate-900 bg-slate-900 px-4 text-sm font-black text-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.65)] transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
        >
          Login
        </Link>
      )}
    </div>
  );
}

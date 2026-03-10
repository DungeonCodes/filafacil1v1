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
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-slate-800 bg-white/90 p-2 shadow-sm">
      <nav aria-label="Navegacao principal do sistema" className="min-w-0 flex-1 overflow-x-auto">
        <ul className="flex min-w-max gap-2">
          {MAIN_ROUTES.map((route) => {
            const isActive = route.href === activePath;
            return (
              <li key={route.href}>
                <Link
                  href={route.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center justify-center rounded-xl border-2 px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 ${
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-800 hover:border-slate-500 hover:bg-slate-100"
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
            className="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-rose-700 bg-rose-700 px-4 text-sm font-bold text-white transition hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
          >
            Sair
          </button>
        </form>
      ) : (
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-slate-900 bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
        >
          Login
        </Link>
      )}
    </div>
  );
}

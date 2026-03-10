import Link from "next/link";

const routes = [
  { href: "/totem", label: "Totem do paciente" },
  { href: "/painel-chamada", label: "Painel de chamada" },
  { href: "/atendente", label: "Tela do atendente" },
  { href: "/medico", label: "Tela do medico" },
  { href: "/admin", label: "Dashboard admin" }
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-8 px-6 py-12">
      <h1 className="text-center text-4xl font-black tracking-tight text-slate-900">FilaFacil Acessivel</h1>
      <p className="max-w-2xl text-center text-lg text-slate-700">
        Sistema web inclusivo de autoatendimento para gestao de filas em unidades de saude.
      </p>
      <nav aria-label="Rotas principais" className="grid w-full gap-4 sm:grid-cols-2">
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className="rounded-2xl border-2 border-slate-700 bg-white px-6 py-5 text-center text-lg font-semibold text-slate-900 shadow-sm transition hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
          >
            {route.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}

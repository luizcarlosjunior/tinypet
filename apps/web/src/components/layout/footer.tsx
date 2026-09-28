import Link from "next/link";
import { Logo } from "./public-header";

export function Footer() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-[var(--muted)]">Conecta tutores de pets aos profissionais que cuidam deles.</p>
        </div>
        <FooterCol title="Para tutores" links={[["/buscar", "Buscar parceiros"], ["/cursos", "Cursos"], ["/cadastro", "Criar conta"], ["/inicio", "Minha área"]]} />
        <FooterCol title="Para parceiros" links={[["/painel/novo", "Criar meu negócio"], ["/painel", "Painel do parceiro"], ["/entrar", "Entrar"]]} />
        <FooterCol title="tinyPet" links={[["/termos", "Termos de uso"], ["/privacidade", "Política de privacidade"]]} />
      </div>
      <div className="border-t py-4 text-center text-xs text-[var(--muted)]">© {new Date().getFullYear()} tinyPet · Feito com carinho para quem ama pets.</div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <nav aria-label={title}>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <ul className="space-y-1.5">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-[var(--muted)] hover:text-[var(--fg)] hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

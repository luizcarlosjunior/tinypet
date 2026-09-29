import type { Metadata } from "next";
export const metadata: Metadata = { title: "Termos de uso" };

export default function TermosPage() {
  return (
    <article className="prose prose-sm mx-auto max-w-3xl dark:prose-invert">
      <h1 className="text-2xl font-bold">Termos de uso</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Versão 1 · Última atualização: setembro de 2026</p>
      <div className="mt-6 space-y-4 text-sm">
        <section>
          <h2 className="font-semibold">1. O serviço</h2>
          <p>O tinyPet conecta tutores de pets a parceiros (treinadores, clínicas veterinárias, lojas e pet shops) e oferece a esses parceiros ferramentas de gestão de clientes, agenda e financeiro. Uma única conta pode ser usada como tutor e como membro de um ou mais parceiros.</p>
        </section>
        <section>
          <h2 className="font-semibold">2. Conta e responsabilidades</h2>
          <p>Você é responsável por manter seus dados corretos e sua senha em segurança. Conteúdo publicado (avaliações, fotos, descrições) deve ser verdadeiro e respeitoso. Avaliações podem ser denunciadas e moderadas pela equipe tinyPet.</p>
        </section>
        <section>
          <h2 className="font-semibold">3. Agendamentos, contratos e pagamentos</h2>
          <p>Agendamentos são solicitações confirmadas pelo parceiro. Cancelamentos seguem a política de cada parceiro. Contratos e parcelas registrados na plataforma são acordos entre tutor e parceiro; o tinyPet não é parte desses acordos.</p>
        </section>
        <section>
          <h2 className="font-semibold">4. Planos</h2>
          <p>O plano Free é permanente e tem limites por módulo. Planos pagos liberam mais capacidade e podem ser cancelados a qualquer momento.</p>
        </section>
        <section>
          <h2 className="font-semibold">5. Alterações</h2>
          <p>Podemos atualizar estes termos. Mudanças relevantes serão comunicadas e o aceite é registrado com a versão vigente.</p>
        </section>
      </div>
    </article>
  );
}

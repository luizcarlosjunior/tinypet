import type { Metadata } from "next";
export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacidadePage() {
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Política de privacidade</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Versão 1 · Última atualização: setembro de 2026</p>
      <div className="mt-6 space-y-4 text-sm">
        <section>
          <h2 className="font-semibold">Quem trata seus dados</h2>
          <p>Nos termos da LGPD, o parceiro é controlador dos dados da própria carteira de clientes e o tinyPet atua como operador. Tutores com conta são titulares e controlam o que compartilham.</p>
        </section>
        <section>
          <h2 className="font-semibold">O que coletamos</h2>
          <p>Dados de cadastro (nome, e-mail, telefone, endereços), dados dos pets (ficha, saúde, rotina, galeria), agendamentos, contratos e avaliações. Localização é usada apenas com sua permissão, para busca “perto de mim” e comparativos anônimos.</p>
        </section>
        <section>
          <h2 className="font-semibold">Consentimentos</h2>
          <p>Marketing (ofertas de marcas e parceiros), compartilhamento público de fotos e uso anônimo em estatísticas são consentimentos separados, que você liga e desliga em Conta.</p>
        </section>
        <section>
          <h2 className="font-semibold">Seus direitos</h2>
          <p>Você pode baixar seus dados e excluir sua conta a qualquer momento em Conta. Pets e histórico são anonimizados nos parceiros que exigirem guarda (ex.: prontuário clínico).</p>
        </section>
        <section>
          <h2 className="font-semibold">Segurança</h2>
          <p>Senhas com hash, isolamento por parceiro em toda consulta, mídias privadas com URLs assinadas e logs de auditoria em financeiro e exclusões.</p>
        </section>
      </div>
    </article>
  );
}

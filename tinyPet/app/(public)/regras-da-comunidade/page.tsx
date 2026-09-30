import type { Metadata } from "next";
import { IP_BLOCK_DAYS, MEDIA_REPORT_REASONS } from "@tinypet/shared";

export const metadata: Metadata = { title: "Regras da comunidade", description: "O que pode e o que não pode ser publicado no tinyPet, como denunciar e quais são as sanções." };

export default function RegrasPage() {
  return (
    <article className="prose prose-sm mx-auto max-w-3xl dark:prose-invert">
      <h1 className="text-2xl font-bold">Regras da comunidade</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Última atualização: setembro de 2026</p>
      <div className="mt-6 space-y-5 text-sm">
        <section>
          <h2 className="font-semibold">O que publicar</h2>
          <p>O tinyPet é um espaço para os pets e para quem cuida deles. Fotos e vídeos devem ter relação com o seu pet, com os serviços do parceiro ou com o cuidado animal, e respeitar todas as pessoas e animais.</p>
        </section>
        <section>
          <h2 className="font-semibold">O que não é permitido</h2>
          <ul className="list-disc space-y-1 pl-5">
            {MEDIA_REPORT_REASONS.filter((r) => r.key !== "OTHER").map((r) => (
              <li key={r.key}>
                <strong>{r.label}:</strong> {r.description}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="font-semibold">Como denunciar</h2>
          <p>Em qualquer foto ou vídeo publicado por outra pessoa, toque em <strong>Denunciar</strong> e escolha o motivo. A denúncia é anônima para quem publicou e é analisada pela equipe tinyPet.</p>
          <p>Denuncie apenas o que realmente viola estas regras. <strong>Denúncias falsas ou de má-fé</strong> também são punidas: a conta de quem denunciou pode ser suspensa ou impedida de fazer novas denúncias por 7, 15 ou 30 dias, ou para sempre.</p>
        </section>
        <section>
          <h2 className="font-semibold">O que acontece com conteúdo impróprio</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>A foto ou o vídeo é <strong>excluído definitivamente</strong> de todos os lugares onde aparece.</li>
            <li>Quem enviou pode ter a conta <strong>suspensa por 7, 15 ou 30 dias, ou bloqueada para sempre</strong>, conforme a gravidade e o histórico.</li>
            <li>O acesso a partir do endereço de internet (IP) usado no envio pode ser <strong>bloqueado por {IP_BLOCK_DAYS} dias</strong>.</li>
            <li>A pessoa recebe um aviso por e-mail com o motivo.</li>
          </ul>
          <p>Conteúdo ilegal (por exemplo, maus-tratos a animais) pode ser comunicado às autoridades.</p>
        </section>
        <section>
          <h2 className="font-semibold">Discorda de uma decisão?</h2>
          <p>Escreva para o suporte informando seu e-mail de cadastro. A equipe revisa o caso e pode revogar a sanção.</p>
        </section>
      </div>
    </article>
  );
}

# tinyPet — Especificação do Produto (MVP)

Sep 27, 2026 · @Luiz Szpikula

## Visão geral

O tinyPet conecta tutores de pets aos profissionais que cuidam deles, e dá a esses profissionais uma gestão completa de clientes, agenda e financeiro. É web (tinypet no domínio próprio) e app iOS/Android, com uma única conta por pessoa.

**Dois lados da plataforma**

- **Tutores (cliente final):** cadastram-se, cadastram seus pets, mantêm a galeria e o histórico de cada animal, encontram parceiros, agendam visitas, avaliam produtos e serviços.
- **Parceiros:** treinadores/adestradores, clínicas veterinárias, lojas especializadas e pet shops. Publicam perfil e catálogo, e usam o painel para gerir clientes, pets, agenda, contratos e parcelas.

**Premissas do MVP**

- Plano Free permanente com limites por módulo; planos pagos e pacotes liberam mais capacidade (ver Planos e limites). No modelo: campo `plan` em Partner e tabela Subscription.
- Categorias e subcategorias de produtos/serviços são definidas pelo sistema (admin), não pelos parceiros.
- O termo usado para o cliente final ("dono", "tutor", "pai/mãe de pet"…) é configurável pelo admin, e cada usuário escolhe como quer ser chamado.
- Idioma inicial: português do Brasil; moeda BRL; fuso America/Sao\_Paulo.

## Stack e arquitetura

Um monorepo com web (Next.js 14, App Router, Tailwind) e app (Expo, Expo Router) consumindo a mesma API, com tipos compartilhados.

&#91;embedded content: arquitetura · 2 clientes, 1 API, 4 serviços\]

- **Monorepo:** Turborepo com `apps/web`, `apps/mobile` e `packages/db` (Prisma), `packages/shared` (schemas Zod, tipos, constantes).
- **Banco:** MySQL com Prisma ORM; soft delete (`deletedAt`) nas entidades de cliente e pet.
- **Auth:** NextAuth (e-mail/senha + Google e Apple); o app usa token JWT emitido pela mesma API.
- **Mídia:** upload direto do dispositivo ao storage por URL assinada; a API só registra e processa (thumbnails, WebP).
- **Hospedagem sugerida:** Vercel para a web/API, banco MySQL gerenciado, Cloudflare R2 para mídia, EAS Build para o app.

## Perfis e permissões

Uma conta (`User`) pode ser tutor e também membro de um ou mais parceiros; o app troca de contexto sem novo login.

| Perfil | Quem é | O que pode fazer |
| --- | --- | --- |
| Tutor | Cliente final | Gerir perfil, família, pets, galeria, tarefas; agendar; avaliar; ver contratos e parcelas próprios |
| Parceiro — dono | Quem criou o negócio | Tudo do parceiro, incluindo equipe, financeiro e exclusão |
| Parceiro — equipe | Funcionário convidado | Agenda, clientes e pets; financeiro só se o dono liberar |
| Admin tinyPet | Operação da plataforma | Categorias, termos do tutor, espécies/raças, moderação de avaliações e mídia |

**Tipos de parceiro:** treinador/adestrador, clínica veterinária, loja especializada, pet shop (lista mantida pelo admin; um parceiro pode ter mais de um tipo).

**Termos configuráveis do cliente final:** o admin mantém a lista (ex.: Tutor, Dono, Pai de pet, Mãe de pet, Responsável). O padrão é "Tutor"; cada usuário escolhe o seu no perfil e a interface usa esse termo nos textos dele.

## Módulo Cadastros

Tutor e parceiro compartilham contatos e endereços como entidades reutilizáveis (vários por pessoa ou negócio).

**Cadastro do tutor**

- Nome, termo preferido (Tutor/Dono…), avatar (recorte quadrado), data de nascimento opcional.
- Telefones (tipo: celular, fixo, WhatsApp; um principal), e-mails (um principal, verificado), endereços com busca por CEP (ViaCEP).
- Família: pessoas vinculadas (nome, parentesco, telefone), que podem ser convidadas a acessar os pets.

**Cadastro do parceiro**

- Nome fantasia, tipo(s), descrição, documento opcional: CNPJ (validado, busca de razão social) ou CPF, ou nenhum.
- Contatos e endereços (o principal aparece no mapa), horário de funcionamento, área de atendimento para quem vai até o cliente (raio em km).
- Site e redes sociais: Instagram, Facebook, TikTok, YouTube, WhatsApp, LinkedIn.
- Logomarca: upload e recorte no próprio sistema, salva quadrada com no máximo 1000×1000 px.
- Até 10 fotos internas do estabelecimento, com ordem e legenda.
- Página pública em `tinypet…/p/<slug>` com perfil, catálogo, fotos e avaliações.

**Regras**

- E-mail e celular verificados antes de publicar a página do parceiro.
- Um parceiro só aparece na busca pública com logo, endereço ou área de atendimento, e ao menos um item no catálogo.

## Módulo Pets

O pet é o centro do app: uma ficha única que o tutor controla e que os parceiros autorizados enxergam e complementam.

**Ficha do pet**

- Nome, espécie (cachorro, gato, pássaro, tartaruga, peixe, roedor, réptil, outro), raça (lista por espécie, com "SRD" e "outra"), cor/pelagem, sexo, porte, data de nascimento (ou idade aproximada), castrado, microchip.
- Avatar com recorte quadrado.
- Observações: temperamento, cuidados especiais, alimentação.
- Vários responsáveis: o tutor principal pode dar acesso a familiares (ver ou editar).

**Alimentação e marcas**

O tutor informa o que cada pet come, e o tinyPet usa isso para indicar lojas e ofertas daquelas marcas perto dele.

- Por pet, um ou mais itens: tipo (ração seca, ração úmida, alimentação natural, petisco, suplemento), marca, linha/produto (ex.: filhote raças pequenas), tamanho da embalagem.
- Opcional: quantidade diária e data da última compra, para estimar quando a embalagem acaba e lembrar da reposição alguns dias antes.
- Marcas e linhas vêm de uma lista mantida pelo admin; se não existir, o tutor sugere e o admin aprova.
- Indicações: lojas e pet shops próximos que têm a marca no catálogo, ofertas ativas dessa marca, e alternativas da mesma linha quando o produto estiver em falta.
- Receber ofertas depende de consentimento de marketing do tutor (LGPD) e pode ser desligado por pet ou por marca.
- Para parceiros e admin, a demanda por marca aparece de forma agregada nos relatórios (ex.: marcas mais usadas por cidade), sem identificar tutores.

**Medidas e peso**

Tutores e veterinários registram peso e medidas ao longo da vida do pet, e o app mostra gráficos de evolução em cada fase (filhote, adulto, idoso).

- Cada registro: data, peso (kg ou g para pets pequenos), altura na cernelha, comprimento, circunferência do pescoço, do tórax e do abdômen, escore de condição corporal (ECC 1 a 9) e observações; só o peso é obrigatório.
- Quem registrou fica marcado: tutor ou parceiro. Registros de clínica veterinária levam selo "aferido por veterinário"; o tutor não edita registros do parceiro.
- Gráficos por medida com o período escolhido (6 meses, 1 ano, vida toda), faixas coloridas das fases da vida ao fundo e pontos diferentes para registros do tutor e do veterinário.
- Faixa de referência opcional por espécie, raça e porte (cadastrada pelo admin) aparece sombreada no gráfico.
- Alertas: variação de peso acima de um limite no período (padrão sugerido: 10% em 30 dias) avisa o tutor e o parceiro veterinário vinculado; lembrete de pesagem mensal opcional.
- Circunferência do pescoço e do tórax alimentam indicações de tamanho de coleira, peitoral e roupa no catálogo.
- Unidades em sistema métrico; exportação do histórico em PDF para levar à consulta.

**Habilidades e comandos**

Tutores e adestradores marcam o que o pet já sabe fazer, e o app compara com pets semelhantes da mesma raça, cidade e estado.

- Lista de comandos por espécie mantida pelo admin (ex.: senta, deita, fica, vem, dá a pata, rola, em pé, junto, espera, solta), mais comandos personalizados criados pelo tutor ou adestrador.
- Cada comando tem nível: aprendendo, responde às vezes, domina. Guarda a data em que foi dominado, que entra na linha do tempo do pet.
- Quem marcou fica registrado; quando o adestrador vinculado confirma, o comando ganha o selo "validado por adestrador".
- Aulas de cursos e sessões de pacotes de adestramento podem marcar comandos trabalhados; badges por marcos (ex.: primeiros 5 comandos, 10 comandos dominados).

**Comparativo com pets semelhantes**

- Para cada comando: percentual de pets semelhantes que o dominam (ex.: "68% dos Border Collies adultos em Curitiba sabem rolar").
- Resumo do pet: quantos comandos domina e em que posição fica (ex.: "sabe mais comandos que 72% dos pets da mesma raça no PR").
- Grupo de comparação: mesma espécie e fase da vida, com filtros combináveis: raça, estado, cidade e "próximos de mim" (raio padrão de 10 km, configurável pelo admin). "Próximos de mim" usa a localização atual com permissão ou, sem ela, as coordenadas do endereço principal do tutor.
- Mínimo de 20 pets no grupo; abaixo disso o app amplia o escopo automaticamente (próximos de mim → cidade → estado → Brasil) e avisa.
- Só entram pets com habilidades registradas e tutores que permitem uso anônimo nas estatísticas; comandos personalizados ficam fora do comparativo.
- Os percentuais são recalculados diariamente por um job, não em tempo real.

**Galeria**

- Galeria estilo Instagram por pet (feed e stories de 24 h) com fotos e vídeos; cada item do feed tem título, descrição, data (do momento, não do upload) e observações.
- Vídeos 16:9 ou 9:16, até 10 MB; fotos até 10 MB, convertidas para WebP com miniatura.
- Visibilidade por item: privado, família, parceiros vinculados. No plano Free do tutor, galeria e stories ficam bloqueados: só o avatar do pet pode ser enviado.

**Histórico (linha do tempo)**

- Visitas concluídas, vacinas, vermífugos, pesagens, conquistas e marcos da galeria em uma linha do tempo única por pet.
- Parceiro vinculado registra atendimentos e anexos (ex.: receita, laudo em PDF) no histórico.

**Pet falecido**

- O tutor (ou o parceiro, no CRM) pode marcar o pet como falecido, com data e uma mensagem opcional; a ação pede confirmação e pode ser desfeita pelo tutor.
- Ao marcar: agendamentos futuros são cancelados com aviso aos parceiros, tarefas, lembretes de vacina e streaks param, e o pet sai de listas ativas, busca e aniversariantes.
- Ficha, galeria e histórico continuam guardados; o perfil vira um memorial, com selo discreto e a data, sem badges ou conquistas novas.
- Contratos e parcelas em aberto não são cancelados automaticamente: o parceiro recebe o aviso e decide.
- Sugestão: pets falecidos não contam no limite de 5 pets do plano Free.

## Módulo Catálogo e Avaliações

Cada parceiro publica produtos e serviços dentro de categorias fixas do sistema; tutores avaliam de 1 a 5 com depoimento.

**Itens do catálogo**

- Tipo (produto ou serviço), nome, descrição, categoria e subcategoria, preço (ou "sob consulta"), preço promocional com validade.
- Serviço: duração em minutos, se atende no local, a domicílio ou online, e se pode ser agendado pelo app.
- Espécies atendidas (filtro na busca). Produtos têm marca e linha (lista do admin), cruzadas com a alimentação dos pets para indicar lojas e ofertas aos tutores.
- Mídia: até 10 fotos e vídeos 16:9 ou 9:16 de até 10 MB, com capa escolhida.
- Status: rascunho, publicado, pausado.

**Categorias de exemplo (admin edita)**

| Categoria | Subcategorias |
| --- | --- |
| Saúde | Consulta, vacinação, exames, cirurgia, odontologia |
| Adestramento | Obediência básica, comportamento, filhotes, agility |
| Estética | Banho, tosa, hidratação, corte de unhas |
| Hospedagem e passeio | Hotel, creche, pet sitter, dog walker |
| Alimentação | Ração seca, úmida, natural, petiscos |
| Acessórios | Coleiras, camas, brinquedos, transporte |
| Farmácia | Antipulgas, vermífugos, suplementos |

**Avaliações**

- Nota 1–5 e depoimento por item (e nota geral do parceiro calculada pela média ponderada dos itens).
- Selo "cliente verificado" quando o tutor tem visita concluída ou contrato com o parceiro.
- Uma avaliação por tutor por item, editável; parceiro pode responder publicamente uma vez.
- Denúncia por qualquer usuário; admin modera (ocultar, restaurar). Parceiro não apaga avaliações.

## Módulo CRM do parceiro

O parceiro mantém a própria carteira de clientes, com ou sem conta no tinyPet; quando o cliente tem conta, os dados se vinculam por convite.

**Ficha do cliente**

- Nome, lista de e-mails, lista de telefones, lista de endereços (cada um com rótulo e um principal).
- Familiares: nome, parentesco, telefone, e-mail, se pode autorizar atendimentos e retirar o pet.
- Pets: mesma ficha do módulo Pets (nascimento, nome, espécie, raça, cor, avatar), mais galeria de fotos e vídeos com título, descrição, data e observações.
- Notas internas, etiquetas (ex.: VIP, inadimplente) e origem do cliente.

**Vínculo com a conta do tutor**

1. Parceiro cadastra cliente e pets manualmente.
2. Sistema envia convite por e-mail/WhatsApp.
3. Tutor aceita: o cliente do parceiro passa a apontar para a conta do tutor e os pets são unificados (o tutor confirma duplicados).
4. A partir daí, o tutor controla o que o parceiro vê; notas internas do parceiro continuam privadas.

**Ferramentas**

- Busca e filtros por nome, telefone, pet, espécie, etiqueta, aniversário.
- Importação por planilha (CSV) e exportação.
- Aniversariantes do mês (pets e tutores) para ações de relacionamento.

## Módulo Agenda

A agenda organiza visitas e atendimentos por pet, visível para o parceiro (todos os clientes) e para o tutor (todos os seus pets, em todos os parceiros).

**Agendamento**

- Campos: pet(s), cliente, serviço do catálogo (opcional), profissional da equipe, data/hora, duração, local do atendimento (ver abaixo), observações.
- Recorrência: semanal, quinzenal, mensal ou pacote de N sessões (ex.: 10 aulas de adestramento), com geração automática das datas.
- Disponibilidade: horários de trabalho por profissional, bloqueios (folgas, feriados) e intervalo entre atendimentos; o sistema impede conflito.
- Visões: dia, semana, mês e lista; filtro por profissional.

**Local do atendimento**

Todo agendamento tem um marcador obrigatório de onde acontece, que decide rota, reserva de percurso e o que o tutor vê.

| Marcador | Endereço usado | Efeito na agenda |
| --- | --- | --- |
| Na casa do cliente | Endereço do cliente escolhido na ficha | Entra na rota do dia, com percurso reservado e atalhos Google Maps/Waze para o profissional |
| No estabelecimento | Endereço da clínica, loja ou centro de treinamento do parceiro | Sem percurso para o profissional; o tutor recebe o atalho "Como chegar" |

- O serviço do catálogo define o marcador padrão (ex.: consulta = no estabelecimento, adestramento = na casa do cliente), e cada agendamento pode trocar.
- O card mostra o marcador com ícone e cor, e a agenda filtra por ele.
- Sugestão para confirmar: um terceiro marcador "Outro local" (praça, parque, local combinado) e "Online" para cursos e orientações.
- No modelo: `Appointment.locationType` (`CLIENT_HOME | PARTNER_VENUE`) e `Appointment.addressId`.

**Como chegar (Google Maps e Waze)**

- Em todo agendamento a domicílio, o card da agenda e o detalhe da visita têm botões "Google Maps" e "Waze" que abrem a rota até o endereço do cliente; no iOS também aparece o Apple Maps.
- O mesmo atalho aparece para o tutor nos agendamentos no local do parceiro.
- Links usam as coordenadas do endereço (geocodificadas no cadastro) e caem para o endereço em texto se não houver coordenadas:
  - Google Maps: `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`
  - Waze: `https://waze.com/ul?ll=LAT,LNG&navigate=yes`
- No app, se o aplicativo não estiver instalado, o link abre a versão web; o profissional pode definir o app de navegação padrão para abrir direto com um toque.
- Na visão do dia, botão "Rota do dia" abre no Google Maps a sequência de visitas a domicílio na ordem dos horários.
- Complemento, ponto de referência e instruções de acesso (portaria, interfone) aparecem junto do botão.

**Prévia e planejamento da rota do dia**

Na visão do dia, o profissional vê o mapa com as visitas em ordem e o percurso entre cada uma, e o sistema reserva e sugere o tempo de deslocamento.

- Prévia: mapa com os pontos numerados na ordem dos horários, saindo do endereço-base do profissional (ou da localização atual) e, opcionalmente, voltando a ele.
- Entre cada atendimento: distância em km e tempo estimado de carro no horário previsto de saída (considerando trânsito), além do total do dia em km e horas ao volante.
- Reserva de percurso: o tempo de deslocamento entra na agenda como um bloco próprio antes de cada visita, e esse tempo fica indisponível para novos agendamentos.
- Alertas: quando o intervalo entre dois atendimentos é menor que o percurso estimado mais uma folga (padrão 10 min, configurável), o card fica em destaque com o atraso previsto.
- Sugestões: reordenar as visitas do dia para rodar menos, e ajustar horários para caber o percurso; cada sugestão mostra quanto economiza em km e minutos.
- Aplicar sugestões é sempre decisão do profissional; se o horário combinado com o tutor mudar, o tutor recebe a proposta e precisa aceitar.
- Horários oferecidos ao tutor já descontam o percurso a partir da visita anterior e até a próxima, evitando encaixes impossíveis.
- Opcional: custo estimado do dia (km × custo por km definido pelo profissional).

Implementação: Google Routes API (matriz de distâncias e rotas com trânsito) com cache por par de endereços e horário, para controlar custo; se a API falhar, usa distância em linha reta com uma velocidade média e marca como estimativa.

**Fluxo de status:** Solicitada (pelo tutor) → Confirmada → Em andamento → Concluída. Saídas: Cancelada (com motivo e quem cancelou) ou Não compareceu. Um agendamento criado pelo parceiro já nasce Confirmado.

**Pelo lado do tutor**

- Solicitar horário em serviços agendáveis, vendo só os horários livres.
- Cancelar ou pedir remarcação até o prazo definido pelo parceiro (ex.: 24 h antes).

**Lembretes e registro**

- Lembrete por push e e-mail 24 h e 2 h antes (configurável); WhatsApp na fase 2.
- Ao concluir: relato do atendimento, fotos, próximos passos; tudo vai para o histórico do pet.
- Opção de exportar para Google Calendar/iCal (link de assinatura por profissional).

## Módulo Financeiro e Contratos

No MVP o financeiro é um controle: registra contratos, parcelas previstas e pagamentos recebidos fora do app; cobrança online via Pagar.me (PIX, boleto, cartão) entra na fase 3.

**Contratos**

- Cliente, pet(s), itens do catálogo ou descrição livre, valor total, desconto, número de parcelas, 1º vencimento, periodicidade.
- Tipos comuns: pacote de sessões (vincula as aulas geradas na agenda), plano mensal recorrente (creche, banho semanal), serviço avulso.
- Status: rascunho, ativo, concluído, cancelado. Termos em texto e aceite do tutor pelo app (data, hora e IP registrados), com PDF gerado.

**Parcelas e lançamentos**

- Parcelas geradas automaticamente: número, vencimento, valor, status (a vencer, vencida, paga, cancelada).
- Baixa manual: data do pagamento, valor pago, forma (PIX, dinheiro, cartão, boleto, transferência), comprovante opcional; aceita pagamento parcial.
- Lançamentos avulsos de receita e despesa com categoria, para ter o caixa completo.

**Painel e relatórios**

| Indicador | Detalhe |
| --- | --- |
| A receber | Parcelas a vencer por período |
| Vencidas | Lista com cliente, dias em atraso e botão de lembrete |
| Recebido | Por mês, por forma de pagamento, por serviço |
| Fluxo de caixa | Receitas menos despesas por mês |

- Exportação CSV/Excel. Tutor vê apenas os próprios contratos e parcelas, com lembrete de vencimento.
- Emissão de nota fiscal fica fora do MVP.

## Módulos extras para o tutor

Estes módulos dão motivo para o tutor abrir o app toda semana, mesmo sem agendamento marcado.

**Rotinas e tarefas do pet**

- Lista de tarefas por pet, avulsas ou recorrentes: passeio, remédio, escovar dentes, trocar água do aquário, limpar gaiola.
- Modelos prontos por espécie; o parceiro pode enviar uma rotina (ex.: exercícios do adestrador, pós-operatório da clínica) que o tutor aceita.
- Tarefas compartilhadas com a família: quem marcou como feito aparece no histórico.

**Saúde preventiva**

- Carteira de vacinação e vermífugos com próxima dose e lembrete automático.
- Peso e medidas com gráficos de evolução (ver Medidas e peso no módulo Pets).

**Badges e conquistas**

| Conquista | Como ganha |
| --- | --- |
| Primeiros passos | Completa o perfil do pet com avatar |
| Vacinas em dia | Nenhuma dose atrasada por 6 meses |
| Rotina de ferro | 30 dias seguidos com tarefas concluídas |
| Formado | Conclui um pacote de adestramento |
| Fotógrafo | 50 itens na galeria |
| Voz da comunidade | 5 avaliações publicadas |

- Sequência (streak) de dias com rotina cumprida e níveis do pet.
- Parceiro pode conceder badges próprias (ex.: "Aluno nota 10" da escola de adestramento).
- Aniversário do pet: card comemorativo compartilhável e aviso ao parceiro.

**Mural de marcos**

- Linha do tempo compartilhável com momentos da galeria, conquistas e aniversários, com imagem pronta para redes sociais.

## Módulo Cursos

Treinadores, clínicas, lojas e pet shops podem criar cursos para tutores; no plano Free, 1 curso com até 5 aulas.

**Estrutura do curso**

- Curso: título, descrição, capa, categoria, espécies-alvo, nível (iniciante, intermediário, avançado), preço (grátis ou pago), status (rascunho, publicado, arquivado).
- Módulos opcionais agrupando aulas; aula com título, descrição, vídeo 16:9 ou 9:16, texto, anexos (PDF) e duração.
- Exercício prático por aula: tarefa que vai para a rotina do pet (ex.: "treinar senta 3x ao dia"), ligando cursos ao módulo de tarefas.

**Para o tutor**

- Matrícula vinculada a um ou mais pets; progresso por aula e percentual concluído.
- Certificado em PDF e badge ao concluir (ex.: "Formado em obediência básica").
- Avaliação 1–5 e depoimento do curso, com as mesmas regras do catálogo.

**Para o parceiro**

- Lista de alunos, progresso e dúvidas por aula.
- Curso pago gera contrato e parcelas no módulo Financeiro (cobrança online na fase 3).
- Curso pode ser incluído em um pacote de serviço (ex.: 10 aulas presenciais + curso online de apoio).

## Planos e limites

Cada plano define, módulo por módulo, o que está liberado e quanto; tudo é configurado pelo admin, sem deploy.

**Como funciona**

- O admin cria planos (nome, preço mensal e anual, período de teste, visível ou não) e, para cada plano, define um limite por recurso: liberado sim/não ou uma quantidade (ou ilimitado).
- Pacotes adicionais (add-ons) somam capacidade a qualquer plano pago, ex.: +1 curso, +5 GB, +1 profissional na equipe.
- A API verifica o limite antes de criar qualquer recurso; ao atingir, mostra o uso atual e o convite para o upgrade.
- Rebaixar de plano não apaga nada: o que passa do limite fica somente leitura até a regularização.

**Planos do parceiro — exemplo (valores a definir, exceto os do Free para cursos)**

| Recurso | Free | Pro | Business |
| --- | --- | --- | --- |
| Cursos | 1 | 5 | Ilimitado |
| Aulas por curso | 5 | 30 | Ilimitado |
| Cursos pagos | Não | Sim | Sim |
| Itens no catálogo | 10 | 100 | Ilimitado |
| Clientes no CRM | 50 | 1.000 | Ilimitado |
| Profissionais na equipe | 1 | 5 | 20 |
| Agenda online para tutores | Sim | Sim | Sim |
| Contratos ativos | 5 | Ilimitado | Ilimitado |
| Armazenamento de mídia | 1 GB | 20 GB | 100 GB |
| Lembretes por WhatsApp | Não | Sim | Sim |
| Badges próprias | Não | Sim | Sim |
| Destaque na busca | Não | Não | Sim |

**Planos do tutor (cliente final)**

O tutor também tem plano: o Free permite até 5 pets e só o avatar de cada um; galeria e stories são do plano pago.

| Recurso | Free | Plus (valores a definir) |
| --- | --- | --- |
| Pets cadastrados | 5 | A definir |
| Avatar do pet | Sim | Sim |
| Galeria de fotos e vídeos (feed) | Não | Sim |
| Stories | Não | Sim |
| Armazenamento de mídia | Só avatares | A definir |
| Agenda, tarefas, vacinas, badges, avaliações | Sim | Sim |
| Cursos gratuitos de parceiros | Sim | Sim |

- O limite de 5 pets vale só para pets que o próprio tutor cria. Pets cadastrados por parceiros e vinculados à conta do tutor não contam no limite.

* A cobrança da assinatura entra via Pagar.me na fase 3; até lá, o admin atribui planos manualmente (ex.: parceiros-piloto).

## Pagamentos — Pagar.me

O gateway inicial é o Pagar.me (API v5), usado em dois fluxos: o tinyPet cobra a assinatura dos parceiros, e os parceiros cobram tutores com repasse automático via split.

| Fluxo | Quem paga → quem recebe | Recurso Pagar.me | Meios |
| --- | --- | --- | --- |
| Assinatura do plano do parceiro | Parceiro → tinyPet | Planos e assinaturas (recorrência) | Cartão e boleto; PIX só em pagamento anual avulso |
| Assinatura do plano do tutor | Tutor → tinyPet | Planos e assinaturas (recorrência) | Cartão; PIX só em pagamento anual avulso |
| Pacotes adicionais | Parceiro → tinyPet | Pedido avulso ou item na assinatura | Cartão, boleto, PIX |
| Parcelas de contratos | Tutor → parceiro | Pedido por parcela com split para o recebedor do parceiro | PIX, boleto, cartão |
| Cursos pagos | Tutor → parceiro | Pedido com split; cartão parcelado permitido | PIX, cartão |

**Como integra**

- Cada parceiro que quiser receber online vira um recebedor (recipient) no Pagar.me, com dados bancários e prova de vida (KYC) feitos no onboarding do painel.
- Regra de split por pedido: parceiro recebe o valor e o tinyPet pode reter uma taxa configurável por plano (0% no início); quem paga a taxa do gateway fica definido na regra.
- Cartão sempre tokenizado no cliente (tokenizecard.js na web, endpoint de token no app); o tinyPet nunca armazena dados de cartão.
- Webhooks (pedido pago, falhou, estornado; assinatura renovada, em atraso, cancelada) atualizam `Payment`, `Installment` e `Subscription`; eventos gravados com chave de idempotência e processados por fila.
- Valores enviados em centavos; ambiente de teste (sandbox) com os simuladores do Pagar.me antes de produção.
- Parcela paga pelo gateway dá baixa automática; pagamentos fora do app continuam com baixa manual.
- Integração atrás de uma interface `PaymentProvider`, para permitir outro gateway no futuro sem mexer nos módulos.

[Documentação Pagar.me v5](https://docs.pagar.me/docs/llms) · [Pix no Pagar.me](https://docs.pagar.me/docs/pix-1)

## Relatórios de pets

Relatórios de pets por data de nascimento, estado e cidade, com filtros por espécie, raça e fase da vida; o parceiro vê a própria carteira, o admin vê a plataforma toda.

**Filtros**

| Filtro | Opções |
| --- | --- |
| Espécie (tipo) | Cachorro, gato, pássaro, tartaruga, peixe, roedor, réptil, outro |
| Raça | Lista da espécie escolhida, incluindo SRD |
| Fase da vida | Filhote, adulto, idoso (calculada pela idade) |
| Nascimento | Período, mês de aniversário, faixa de idade |
| Localização | Estado, cidade, bairro (endereço principal do tutor ou do cliente) |
| Outros | Sexo, porte, castrado, status (ativo ou falecido), parceiro, etiqueta do cliente |

**Visões**

- Lista detalhada com pet, tutor, idade, fase da vida, cidade/UF e contato (só para o parceiro, na própria carteira).
- Gráficos: pets por estado e cidade, por espécie e raça, por fase da vida, por mês de nascimento, e evolução de cadastros no tempo.
- Aniversariantes do período com ação rápida de mensagem.
- Exportação CSV e Excel, respeitando os filtros aplicados.

**Fase da vida (padrões editáveis pelo admin, por espécie e porte)**

| Espécie | Filhote | Adulto | Idoso |
| --- | --- | --- | --- |
| Cachorro pequeno | até 12 meses | 1 a 9 anos | 10 anos ou mais |
| Cachorro médio | até 12 meses | 1 a 7 anos | 8 anos ou mais |
| Cachorro grande | até 18 meses | 1,5 a 5 anos | 6 anos ou mais |
| Gato | até 12 meses | 1 a 10 anos | 11 anos ou mais |
| Demais espécies | definido pelo admin | definido pelo admin | definido pelo admin |

- Pet sem data de nascimento usa a idade aproximada informada; sem nenhuma das duas, aparece como "idade desconhecida".
- Pets falecidos ficam fora por padrão e entram só com o filtro de status.
- Relatórios do admin mostram dados agregados, sem nome ou contato do tutor (LGPD); grupos com menos de 5 pets aparecem como "menos de 5".
- Recurso por plano: relatórios básicos no Free, filtros avançados, gráficos e exportação nos planos pagos (ajustável em Planos e limites).

## Regras de mídia e upload

Todo arquivo passa pelo mesmo pipeline: validação no dispositivo, upload direto ao storage, processamento no servidor.

| Uso | Formato aceito | Limite | Tratamento |
| --- | --- | --- | --- |
| Logomarca do parceiro | JPG, PNG, WebP | 10 MB de entrada | Recorte quadrado no sistema; salva no máx. 1000×1000 px |
| Avatar (tutor e pet) | JPG, PNG, WebP, HEIC | 10 MB de entrada | Recorte quadrado; 512×512 px |
| Fotos internas da loja | JPG, PNG, WebP, HEIC | 10 MB cada, até 10 fotos | WebP, lado maior 1920 px + miniatura |
| Fotos de galeria e catálogo | JPG, PNG, WebP, HEIC | 10 MB cada | WebP, lado maior 1920 px + miniatura |
| Vídeos | MP4, MOV | 10 MB cada; 16:9 ou 9:16 | Proporção validada (tolerância de 2%); capa extraída |

- No app, vídeos acima de 10 MB são comprimidos antes do envio; se continuarem grandes, o usuário é avisado.
- Metadados de localização (EXIF/GPS) removidos de toda foto.
- Imagens públicas (catálogo, fotos da loja, logo) passam por moderação automática; conteúdo sinalizado vai para revisão do admin.
- Cota de armazenamento definida pelo plano (ver Planos e limites); tutor no Free só envia avatares de pets e o próprio.

## Modelo de dados

Tabelas, modelos, campos, enums e código ficam em inglês; a interface continua em português. São cerca de 30 tabelas em 8 grupos; contatos, endereços e mídia são polimórficos para servir usuário, cliente do parceiro e parceiro.

| Grupo | Entidades |
| --- | --- |
| Identity | User, Session, OwnerTerm, Membership (user ↔ partner, com papel) |
| Partner | Partner, PartnerType, SocialLink, BusinessHours, VenuePhoto |
| Contacts | Phone, Email, Address (dono: user, client ou partner) |
| Pets & CRM | Client, FamilyMember, Pet, Species, Breed, PetAccess, PetMedia, PetHistoryEvent, LifeStageRule, Skill, PetSkill, SkillStat (agregado diário), PetFood (pet, tipo, marca, linha, embalagem, consumo diário, última compra) |
| Catalog | Category, Subcategory, Brand, ProductLine, CatalogItem, CatalogItemMedia, Review, ReviewReply, Report |
| Courses | Course, CourseModule, Lesson, LessonAttachment, Enrollment, LessonProgress, Certificate |
| Scheduling | Appointment, AppointmentPet, Availability, TimeOff, TravelLeg (distância e tempo entre visitas, bloco reservado) |
| Finance | Contract, ContractItem, Installment, Payment, Transaction |
| Billing | Plan, Feature, PlanFeatureLimit, AddOn, Subscription, SubscriptionAddOn, PaymentRecipient, GatewayOrder, WebhookEvent |
| Engagement | Task, TaskCompletion, Vaccination, BodyMeasurement, MeasurementReference, Badge, EarnedBadge |

Núcleo do schema (Prisma, resumido):

```prisma
model User {
  id           String       @id @default(cuid())
  name         String
  avatarUrl    String?
  ownerTermId  String?      // Tutor, Dono...
  ownerTerm    OwnerTerm?   @relation(fields: [ownerTermId], references: [id])
  memberships  Membership[]
  clients      Client[]     // accepted links with partners
  pets         Pet[]        @relation("PrimaryOwner")
  createdAt    DateTime     @default(now())
  deletedAt    DateTime?
}

model Partner {
  id           String        @id @default(cuid())
  slug         String        @unique
  tradeName    String
  documentType DocumentType? // CNPJ | CPF
  document     String?       // optional
  logoUrl      String?       // max 1000x1000
  website      String?
  plan         String        @default("free")
  types        PartnerType[]
  memberships  Membership[]
  clients      Client[]
  catalogItems CatalogItem[]
}

model Client {                // client in a partner's book
  id            String         @id @default(cuid())
  partnerId     String
  userId        String?        // set when the owner accepts the invite
  name          String
  notes         String?        @db.Text
  familyMembers FamilyMember[]
  pets          Pet[]
  contracts     Contract[]
  partner       Partner        @relation(fields: [partnerId], references: [id])
  user          User?          @relation(fields: [userId], references: [id])
}

model Pet {
  id            String           @id @default(cuid())
  name          String
  speciesId     String
  breedId       String?
  color         String?
  sex           Sex?
  birthDate     DateTime?        @db.Date
  avatarUrl     String?
  ownerId       String?          // account that owns the pet
  clients       Client[]         // partners that serve it
  media         PetMedia[]
  appointments  AppointmentPet[]
  status        PetStatus        @default(ACTIVE) // ACTIVE | DECEASED
  deceasedAt    DateTime?        @db.Date
  memorialNote  String?          @db.Text
  deletedAt     DateTime?
}

model Installment {
  id          String            @id @default(cuid())
  contractId  String
  number      Int
  dueDate     DateTime          @db.Date
  amount      Decimal           @db.Decimal(10, 2)
  status      InstallmentStatus @default(PENDING)
  payments    Payment[]
  contract    Contract          @relation(fields: [contractId], references: [id])
}

enum InstallmentStatus {
  PENDING
  OVERDUE
  PAID
  CANCELED
}
```

Limites por plano (Billing):

```prisma
model Feature {             // e.g. courses, lessons_per_course, storage_mb
  key      String  @id
  module   String  // catalog, courses, crm, scheduling, finance...
  kind     FeatureKind // BOOLEAN | QUANTITY
  audience Audience    // OWNER | PARTNER
  limits   PlanFeatureLimit[]
}

model PlanFeatureLimit {
  planId     String
  featureKey String
  enabled    Boolean @default(true)
  quantity   Int?    // null = unlimited
  plan       Plan    @relation(fields: [planId], references: [id])
  feature    Feature @relation(fields: [featureKey], references: [key])
  @@id([planId, featureKey])
}

model Subscription {
  id        String   @id @default(cuid())
  partnerId String?  @unique // partner plan
  userId    String?  @unique // owner (tutor) plan
  planId    String
  status    SubscriptionStatus // TRIALING | ACTIVE | PAST_DUE | CANCELED
  startsAt  DateTime
  endsAt    DateTime?
  addOns    SubscriptionAddOn[]
}
```

- Tabelas em snake\_case plural via `@@map` (ex.: `Installment` → `installments`), campos em camelCase no Prisma e snake\_case no banco via `@map`.
- Valores em `Decimal(10,2)`; datas em UTC e exibidas em America/Sao\_Paulo.
- Toda consulta do painel é filtrada pelo `partnerId` do membro logado (isolamento entre parceiros).

## Telas principais

O app tem duas navegações conforme o contexto ativo (tutor ou parceiro); a web espelha as mesmas áreas e soma a página pública e o admin.

| Área | Telas | Onde |
| --- | --- | --- |
| Público | Home, busca de parceiros (mapa e lista, filtros por tipo, categoria, espécie, nota), página do parceiro, página do item | Web e app |
| Conta | Cadastro, login, verificação, escolha do termo, troca de contexto | Web e app |
| Tutor | Início (tarefas do dia, próximas visitas, conquistas), Meus pets, ficha e galeria do pet, Agenda, Contratos e parcelas, Avaliações | App primeiro, web responsiva |
| Parceiro | Painel (agenda do dia, a receber, vencidas), Clientes, ficha do cliente e pets, Agenda, Catálogo, Financeiro, Perfil e página pública, Equipe | Web primeiro, app para agenda e clientes |
| Admin | Categorias, termos do tutor, espécies e raças, badges, moderação, usuários e parceiros | Só web |

**Fluxos-chave para validar primeiro**

1. Parceiro se cadastra, recorta a logo, publica 1 serviço e aparece na busca.
2. Parceiro cadastra cliente com pet e envia convite; tutor aceita e vê o pet no app.
3. Tutor solicita horário; parceiro confirma; lembrete chega; parceiro conclui com fotos no histórico.
4. Parceiro cria contrato de 10 aulas em 3 parcelas; aulas vão para a agenda; parcela é baixada.
5. Tutor avalia o serviço concluído com selo de cliente verificado.

## LGPD, segurança e requisitos não funcionais

O parceiro é controlador dos dados da própria carteira e o tinyPet é operador; o tutor com conta é titular e controla o compartilhamento.

**LGPD**

- Termos de uso e política de privacidade no cadastro, com aceite versionado.
- Tutor pode baixar seus dados e excluir a conta; pets e histórico são anonimizados nos parceiros que exigirem guarda (ex.: prontuário clínico).
- Consentimento separado para marketing e para compartilhar fotos publicamente.
- Cliente cadastrado pelo parceiro sem conta recebe aviso no convite sobre o tratamento dos dados.

**Segurança**

- Senhas com hash (argon2), login social, 2FA opcional para parceiros.
- Isolamento por parceiro em toda consulta; URLs de mídia privada assinadas e com expiração.
- Rate limit em login, convites e uploads; log de auditoria em financeiro e exclusões.

**Não funcionais**

- Páginas públicas com SSR e SEO (schema.org LocalBusiness, Product, AggregateRating).
- Meta de carregamento: primeira tela do app em menos de 2 s em 4G.
- Acessibilidade WCAG AA; tema claro e escuro.
- Backups diários do banco com retenção de 30 dias.

## Roadmap e pontos em aberto

Proposta: construir primeiro o lado do parceiro, porque é ele que traz os clientes e pets para dentro da plataforma.

&#91;embedded content: roadmap · 4 fases, 2 marcos\]

A Fase 2 só começa quando 5 parceiros-piloto usarem agenda e clientes no dia a dia; a Fase 3 começa com o beta público nas lojas. Cursos entram na Fase 2 (limites do Free já valem); planos pagos são atribuídos pelo admin até a cobrança online da Fase 3.

**Pontos em aberto**

- [ ] Confirmar a ordem: parceiro antes do tutor, ou os dois lados juntos?
- [ ] Endereço do domínio tinyPet (.com.br ou .com) e se o app terá o mesmo nome nas lojas.
- [ ] Lista final de termos para o cliente final além de Tutor e Dono.
- [ ] Lista final de categorias e subcategorias.
- [ ] Clínicas vão precisar de prontuário veterinário completo ou só do histórico simples?
- [ ] Busca pública por proximidade exige endereço verificado: aceitar parceiros sem endereço fixo (ex.: adestrador que atende em casa)?
- [ ] Identidade visual (logo, cores) para o design das telas.

* [x] Pets vinculados por parceiros contam no limite de 5 do Free? Decidido: não contam.

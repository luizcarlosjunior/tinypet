/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

const SPECIES = [
  { key: "dog", label: "Cachorro" },
  { key: "cat", label: "Gato" },
  { key: "bird", label: "Pássaro" },
  { key: "turtle", label: "Tartaruga" },
  { key: "fish", label: "Peixe" },
  { key: "rodent", label: "Roedor" },
  { key: "reptile", label: "Réptil" },
  { key: "other", label: "Outro" },
];

const BREEDS: Record<string, string[]> = {
  dog: ["Labrador Retriever", "Golden Retriever", "Shih Tzu", "Poodle", "Bulldog Francês", "Yorkshire Terrier", "Pug", "Border Collie", "Pastor Alemão", "Rottweiler", "Dachshund", "Lhasa Apso", "Spitz Alemão", "Beagle", "Pinscher", "Chihuahua", "Maltês", "Boxer", "Pit Bull", "Husky Siberiano"],
  cat: ["Persa", "Siamês", "Maine Coon", "Ragdoll", "Sphynx", "Bengal", "British Shorthair", "Angorá"],
  bird: ["Calopsita", "Periquito", "Canário", "Agapornis", "Papagaio"],
  turtle: ["Tigre d'água", "Jabuti"],
  fish: ["Betta", "Guppy", "Kinguio", "Tetra neon"],
  rodent: ["Hamster", "Porquinho-da-índia", "Chinchila", "Coelho"],
  reptile: ["Iguana", "Gecko", "Corn snake"],
  other: [],
};

const PARTNER_TYPES = [
  { key: "trainer", label: "Treinador / adestrador" },
  { key: "vet_clinic", label: "Clínica veterinária" },
  { key: "specialty_store", label: "Loja especializada" },
  { key: "pet_shop", label: "Pet shop" },
];

const CATEGORIES: { key: string; label: string; subs: string[] }[] = [
  { key: "health", label: "Saúde", subs: ["Consulta", "Vacinação", "Exames", "Cirurgia", "Odontologia"] },
  { key: "training", label: "Adestramento", subs: ["Obediência básica", "Comportamento", "Filhotes", "Agility"] },
  { key: "grooming", label: "Estética", subs: ["Banho", "Tosa", "Hidratação", "Corte de unhas"] },
  { key: "boarding", label: "Hospedagem e passeio", subs: ["Hotel", "Creche", "Pet sitter", "Dog walker"] },
  { key: "food", label: "Alimentação", subs: ["Ração seca", "Ração úmida", "Alimentação natural", "Petiscos"] },
  { key: "accessories", label: "Acessórios", subs: ["Coleiras", "Camas", "Brinquedos", "Transporte"] },
  { key: "pharmacy", label: "Farmácia", subs: ["Antipulgas", "Vermífugos", "Suplementos"] },
];

const OWNER_TERMS = ["Tutor", "Dono", "Pai de pet", "Mãe de pet", "Responsável"];

const FEATURES: { key: string; module: string; label: string; kind: "BOOLEAN" | "QUANTITY"; audience: "OWNER" | "PARTNER" }[] = [
  { key: "courses", module: "courses", label: "Cursos", kind: "QUANTITY", audience: "PARTNER" },
  { key: "lessons_per_course", module: "courses", label: "Aulas por curso", kind: "QUANTITY", audience: "PARTNER" },
  { key: "paid_courses", module: "courses", label: "Cursos pagos", kind: "BOOLEAN", audience: "PARTNER" },
  { key: "catalog_items", module: "catalog", label: "Itens no catálogo", kind: "QUANTITY", audience: "PARTNER" },
  { key: "crm_clients", module: "crm", label: "Clientes no CRM", kind: "QUANTITY", audience: "PARTNER" },
  { key: "team_members", module: "team", label: "Profissionais na equipe", kind: "QUANTITY", audience: "PARTNER" },
  { key: "online_booking", module: "scheduling", label: "Agenda online para tutores", kind: "BOOLEAN", audience: "PARTNER" },
  { key: "active_contracts", module: "finance", label: "Contratos ativos", kind: "QUANTITY", audience: "PARTNER" },
  { key: "storage_mb", module: "media", label: "Armazenamento de mídia (MB)", kind: "QUANTITY", audience: "PARTNER" },
  { key: "whatsapp_reminders", module: "scheduling", label: "Lembretes por WhatsApp", kind: "BOOLEAN", audience: "PARTNER" },
  { key: "custom_badges", module: "engagement", label: "Badges próprias", kind: "BOOLEAN", audience: "PARTNER" },
  { key: "search_highlight", module: "catalog", label: "Destaque na busca", kind: "BOOLEAN", audience: "PARTNER" },
  { key: "advanced_reports", module: "reports", label: "Relatórios avançados", kind: "BOOLEAN", audience: "PARTNER" },
  { key: "owner_pets", module: "pets", label: "Pets cadastrados", kind: "QUANTITY", audience: "OWNER" },
  { key: "owner_gallery", module: "pets", label: "Galeria de fotos e vídeos", kind: "BOOLEAN", audience: "OWNER" },
  { key: "owner_stories", module: "pets", label: "Stories", kind: "BOOLEAN", audience: "OWNER" },
  { key: "owner_storage_mb", module: "media", label: "Armazenamento de mídia (MB)", kind: "QUANTITY", audience: "OWNER" },
];

type Limit = [string, boolean, number | null];
const PLANS: { key: string; name: string; audience: "OWNER" | "PARTNER"; priceMonthly: number | null; priceYearly: number | null; isDefault: boolean; sortOrder: number; limits: Limit[] }[] = [
  {
    key: "free", name: "Free", audience: "PARTNER", priceMonthly: 0, priceYearly: 0, isDefault: true, sortOrder: 0,
    limits: [["courses", true, 1], ["lessons_per_course", true, 5], ["paid_courses", false, null], ["catalog_items", true, 10], ["crm_clients", true, 50], ["team_members", true, 1], ["online_booking", true, null], ["active_contracts", true, 5], ["storage_mb", true, 1024], ["whatsapp_reminders", false, null], ["custom_badges", false, null], ["search_highlight", false, null], ["advanced_reports", false, null]],
  },
  {
    key: "pro", name: "Pro", audience: "PARTNER", priceMonthly: null, priceYearly: null, isDefault: false, sortOrder: 1,
    limits: [["courses", true, 5], ["lessons_per_course", true, 30], ["paid_courses", true, null], ["catalog_items", true, 100], ["crm_clients", true, 1000], ["team_members", true, 5], ["online_booking", true, null], ["active_contracts", true, null], ["storage_mb", true, 20480], ["whatsapp_reminders", true, null], ["custom_badges", true, null], ["search_highlight", false, null], ["advanced_reports", true, null]],
  },
  {
    key: "business", name: "Business", audience: "PARTNER", priceMonthly: null, priceYearly: null, isDefault: false, sortOrder: 2,
    limits: [["courses", true, null], ["lessons_per_course", true, null], ["paid_courses", true, null], ["catalog_items", true, null], ["crm_clients", true, null], ["team_members", true, 20], ["online_booking", true, null], ["active_contracts", true, null], ["storage_mb", true, 102400], ["whatsapp_reminders", true, null], ["custom_badges", true, null], ["search_highlight", true, null], ["advanced_reports", true, null]],
  },
  {
    key: "owner_free", name: "Free", audience: "OWNER", priceMonthly: 0, priceYearly: 0, isDefault: true, sortOrder: 0,
    limits: [["owner_pets", true, 5], ["owner_gallery", false, null], ["owner_stories", false, null], ["owner_storage_mb", true, 50]],
  },
  {
    key: "owner_plus", name: "Plus", audience: "OWNER", priceMonthly: null, priceYearly: null, isDefault: false, sortOrder: 1,
    limits: [["owner_pets", true, 20], ["owner_gallery", true, null], ["owner_stories", true, null], ["owner_storage_mb", true, 10240]],
  },
];

const BADGES = [
  { key: "first_steps", name: "Primeiros passos", description: "Completa o perfil do pet com avatar" },
  { key: "vaccines_up_to_date", name: "Vacinas em dia", description: "Nenhuma dose atrasada por 6 meses" },
  { key: "iron_routine", name: "Rotina de ferro", description: "30 dias seguidos com tarefas concluídas" },
  { key: "graduated", name: "Formado", description: "Conclui um pacote de adestramento" },
  { key: "photographer", name: "Fotógrafo", description: "50 itens na galeria" },
  { key: "community_voice", name: "Voz da comunidade", description: "5 avaliações publicadas" },
  { key: "five_commands", name: "5 comandos", description: "Primeiros 5 comandos dominados" },
  { key: "ten_commands", name: "10 comandos", description: "10 comandos dominados" },
];

const DOG_SKILLS = ["Senta", "Deita", "Fica", "Vem", "Dá a pata", "Rola", "Em pé", "Junto", "Espera", "Solta"];
const CAT_SKILLS = ["Vem", "Senta", "Dá a pata", "Usa a caixa de areia", "Usa o arranhador"];

const BRANDS: Record<string, string[]> = {
  "Royal Canin": ["Mini Puppy", "Mini Adult", "Medium Adult", "Maxi Adult", "Kitten", "Indoor"],
  "Premier": ["Fórmula Cães Adultos Raças Pequenas", "Fórmula Filhotes", "Ambientes Internos Gatos"],
  "GranPlus": ["Menu Adultos", "Choice Filhotes"],
  "Hill's": ["Science Diet Adult", "Science Diet Puppy"],
  "Golden": ["Fórmula Adultos", "Fórmula Filhotes"],
  "Whiskas": ["Adulto Carne", "Sachê"],
  "Pedigree": ["Adulto Carne", "Júnior"],
};

const TASK_TEMPLATES: Record<string, { title: string; rule: object }[]> = {
  dog: [
    { title: "Passeio", rule: { freq: "daily", times: ["08:00", "18:00"] } },
    { title: "Escovar os dentes", rule: { freq: "weekly", days: [1, 4] } },
    { title: "Antipulgas", rule: { freq: "monthly" } },
  ],
  cat: [
    { title: "Limpar caixa de areia", rule: { freq: "daily", times: ["09:00"] } },
    { title: "Escovar pelos", rule: { freq: "weekly", days: [0] } },
  ],
  fish: [{ title: "Trocar água do aquário", rule: { freq: "weekly", days: [6] } }],
  bird: [{ title: "Limpar gaiola", rule: { freq: "weekly", days: [6] } }],
  rodent: [{ title: "Limpar gaiola", rule: { freq: "weekly", days: [6] } }],
};

async function main() {
  console.log("Seeding…");

  for (const [i, t] of OWNER_TERMS.entries()) {
    await prisma.ownerTerm.upsert({ where: { label: t }, update: { sortOrder: i, isDefault: i === 0 }, create: { label: t, sortOrder: i, isDefault: i === 0 } });
  }

  const speciesByKey: Record<string, string> = {};
  for (const [i, s] of SPECIES.entries()) {
    const row = await prisma.species.upsert({ where: { key: s.key }, update: { label: s.label, sortOrder: i }, create: { ...s, sortOrder: i } });
    speciesByKey[s.key] = row.id;
    for (const b of BREEDS[s.key] ?? []) {
      await prisma.breed.upsert({ where: { speciesId_name: { speciesId: row.id, name: b } }, update: {}, create: { speciesId: row.id, name: b } });
    }
    await prisma.breed.upsert({ where: { speciesId_name: { speciesId: row.id, name: "SRD" } }, update: { isMixed: true }, create: { speciesId: row.id, name: "SRD", isMixed: true } });
    await prisma.breed.upsert({ where: { speciesId_name: { speciesId: row.id, name: "Outra" } }, update: { isOther: true }, create: { speciesId: row.id, name: "Outra", isOther: true } });
  }

  // Life stage defaults (months)
  const lsRules: { species: string; size: "SMALL" | "MEDIUM" | "LARGE" | "GIANT" | null; puppy: number; senior: number }[] = [
    { species: "dog", size: "SMALL", puppy: 12, senior: 120 },
    { species: "dog", size: "MEDIUM", puppy: 12, senior: 96 },
    { species: "dog", size: "LARGE", puppy: 18, senior: 72 },
    { species: "dog", size: "GIANT", puppy: 18, senior: 72 },
    { species: "dog", size: null, puppy: 12, senior: 96 },
    { species: "cat", size: null, puppy: 12, senior: 132 },
  ];
  for (const r of lsRules) {
    const existing = await prisma.lifeStageRule.findFirst({ where: { speciesId: speciesByKey[r.species], size: r.size } });
    if (!existing) await prisma.lifeStageRule.create({ data: { speciesId: speciesByKey[r.species]!, size: r.size, puppyUntilMonths: r.puppy, seniorFromMonths: r.senior } });
  }

  for (const [i, t] of PARTNER_TYPES.entries()) {
    await prisma.partnerType.upsert({ where: { key: t.key }, update: { label: t.label, sortOrder: i }, create: { ...t, sortOrder: i } });
  }

  for (const [i, c] of CATEGORIES.entries()) {
    const cat = await prisma.category.upsert({ where: { key: c.key }, update: { label: c.label, sortOrder: i }, create: { key: c.key, label: c.label, sortOrder: i } });
    for (const [j, s] of c.subs.entries()) {
      const key = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
      await prisma.subcategory.upsert({ where: { categoryId_key: { categoryId: cat.id, key } }, update: { label: s, sortOrder: j }, create: { categoryId: cat.id, key, label: s, sortOrder: j } });
    }
  }

  for (const f of FEATURES) {
    await prisma.feature.upsert({ where: { key: f.key }, update: f, create: f });
  }
  for (const p of PLANS) {
    const plan = await prisma.plan.upsert({
      where: { key: p.key },
      update: { name: p.name, audience: p.audience, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly, isDefault: p.isDefault, sortOrder: p.sortOrder },
      create: { key: p.key, name: p.name, audience: p.audience, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly, isDefault: p.isDefault, sortOrder: p.sortOrder },
    });
    for (const [featureKey, enabled, quantity] of p.limits) {
      await prisma.planFeatureLimit.upsert({ where: { planId_featureKey: { planId: plan.id, featureKey } }, update: { enabled, quantity }, create: { planId: plan.id, featureKey, enabled, quantity } });
    }
  }
  for (const a of [
    { key: "extra_course", name: "+1 curso", featureKey: "courses", quantity: 1 },
    { key: "extra_storage_5gb", name: "+5 GB de mídia", featureKey: "storage_mb", quantity: 5120 },
    { key: "extra_member", name: "+1 profissional na equipe", featureKey: "team_members", quantity: 1 },
  ]) {
    await prisma.addOn.upsert({ where: { key: a.key }, update: a, create: a });
  }

  for (const b of BADGES) {
    await prisma.badge.upsert({ where: { key: b.key }, update: b, create: b });
  }

  for (const name of DOG_SKILLS) {
    const key = `dog_${name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    const ex = await prisma.skill.findFirst({ where: { key } });
    if (!ex) await prisma.skill.create({ data: { key, name, speciesId: speciesByKey.dog } });
  }
  for (const name of CAT_SKILLS) {
    const key = `cat_${name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    const ex = await prisma.skill.findFirst({ where: { key } });
    if (!ex) await prisma.skill.create({ data: { key, name, speciesId: speciesByKey.cat } });
  }

  for (const [brand, lines] of Object.entries(BRANDS)) {
    const b = await prisma.brand.upsert({ where: { name: brand }, update: {}, create: { name: brand } });
    for (const l of lines) await prisma.productLine.upsert({ where: { brandId_name: { brandId: b.id, name: l } }, update: {}, create: { brandId: b.id, name: l } });
  }

  for (const [sp, templates] of Object.entries(TASK_TEMPLATES)) {
    for (const t of templates) {
      const ex = await prisma.taskTemplate.findFirst({ where: { speciesId: speciesByKey[sp], title: t.title } });
      if (!ex) await prisma.taskTemplate.create({ data: { speciesId: speciesByKey[sp], title: t.title, rule: t.rule } });
    }
  }

  await prisma.setting.upsert({ where: { key: "comparison_radius_km" }, update: {}, create: { key: "comparison_radius_km", value: 10 } });
  await prisma.setting.upsert({ where: { key: "weight_alert" }, update: {}, create: { key: "weight_alert", value: { pct: 10, days: 30 } } });
  await prisma.setting.upsert({ where: { key: "terms_version" }, update: {}, create: { key: "terms_version", value: "2026-09-01" } });

  // Users
  const defaultTerm = await prisma.ownerTerm.findFirst({ where: { isDefault: true } });
  const pwd = await hash("tinypet123");
  const admin = await prisma.user.upsert({
    where: { email: "admin@tinypet.local" },
    update: {},
    create: { name: "Admin tinyPet", email: "admin@tinypet.local", passwordHash: pwd, role: "ADMIN", emailVerifiedAt: new Date(), ownerTermId: defaultTerm?.id, termsVersion: "2026-09-01", termsAcceptedAt: new Date() },
  });
  const tutor = await prisma.user.upsert({
    where: { email: "tutor@tinypet.local" },
    update: {},
    create: { name: "Ana Tutora", email: "tutor@tinypet.local", passwordHash: pwd, emailVerifiedAt: new Date(), ownerTermId: defaultTerm?.id, termsVersion: "2026-09-01", termsAcceptedAt: new Date() },
  });
  const partnerOwner = await prisma.user.upsert({
    where: { email: "parceiro@tinypet.local" },
    update: {},
    create: { name: "Carlos Adestrador", email: "parceiro@tinypet.local", passwordHash: pwd, emailVerifiedAt: new Date(), ownerTermId: defaultTerm?.id, termsVersion: "2026-09-01", termsAcceptedAt: new Date() },
  });

  const ownerFree = await prisma.plan.findUniqueOrThrow({ where: { key: "owner_free" } });
  for (const u of [admin, tutor, partnerOwner]) {
    await prisma.subscription.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id, planId: ownerFree.id, status: "ACTIVE", startsAt: new Date() } });
  }

  // Demo partner
  const free = await prisma.plan.findUniqueOrThrow({ where: { key: "free" } });
  const partner = await prisma.partner.upsert({
    where: { slug: "cao-feliz-adestramento" },
    update: {},
    create: {
      slug: "cao-feliz-adestramento",
      tradeName: "Cão Feliz Adestramento",
      description: "Adestramento positivo em domicílio e no nosso centro de treinamento em Curitiba.",
      plan: "free",
      published: true,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      serviceRadiusKm: 20,
      types: { create: [{ type: { connect: { key: "trainer" } } }] },
      memberships: { create: { userId: partnerOwner.id, role: "OWNER", canSeeFinance: true } },
      emails: { create: { address: "contato@caofeliz.local", isPrimary: true, verifiedAt: new Date() } },
      phones: { create: { number: "+5541999990000", type: "WHATSAPP", isPrimary: true, verifiedAt: new Date() } },
      addresses: { create: { label: "Centro de treinamento", zipCode: "80010-000", street: "Rua XV de Novembro", number: "100", district: "Centro", city: "Curitiba", state: "PR", latitude: -25.4284, longitude: -49.2733, isPrimary: true } },
      businessHours: { create: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opensAt: "08:00", closesAt: "18:00" })) },
      socialLinks: { create: [{ network: "INSTAGRAM", url: "https://instagram.com/caofeliz" }] },
    },
  });
  await prisma.subscription.upsert({ where: { partnerId: partner.id }, update: {}, create: { partnerId: partner.id, planId: free.id, status: "ACTIVE", startsAt: new Date() } });

  const membership = await prisma.membership.findFirstOrThrow({ where: { partnerId: partner.id, userId: partnerOwner.id } });
  const existingAvail = await prisma.availability.count({ where: { membershipId: membership.id } });
  if (!existingAvail) {
    await prisma.availability.createMany({ data: [1, 2, 3, 4, 5].map((weekday) => ({ membershipId: membership.id, weekday, startsAt: "08:00", endsAt: "18:00" })) });
  }

  const training = await prisma.category.findUniqueOrThrow({ where: { key: "training" } });
  const basic = await prisma.subcategory.findFirst({ where: { categoryId: training.id, key: "obediencia_basica" } });
  const itemCount = await prisma.catalogItem.count({ where: { partnerId: partner.id } });
  if (!itemCount) {
    await prisma.catalogItem.createMany({
      data: [
        { partnerId: partner.id, type: "SERVICE", name: "Aula de obediência básica (domicílio)", description: "Sessão de 60 minutos na casa do tutor.", categoryId: training.id, subcategoryId: basic?.id, price: 150, durationMinutes: 60, serviceLocations: ["CLIENT_HOME"], defaultLocation: "CLIENT_HOME", bookable: true, speciesKeys: ["dog"], status: "PUBLISHED" },
        { partnerId: partner.id, type: "SERVICE", name: "Aula em grupo no centro de treinamento", description: "Turmas de até 6 cães, 50 minutos.", categoryId: training.id, subcategoryId: basic?.id, price: 80, durationMinutes: 50, serviceLocations: ["PARTNER_VENUE"], defaultLocation: "PARTNER_VENUE", bookable: true, speciesKeys: ["dog"], status: "PUBLISHED" },
        { partnerId: partner.id, type: "SERVICE", name: "Pacote 10 aulas de adestramento", description: "10 sessões individuais com acompanhamento.", categoryId: training.id, subcategoryId: basic?.id, price: 1200, durationMinutes: 60, serviceLocations: ["CLIENT_HOME", "PARTNER_VENUE"], defaultLocation: "CLIENT_HOME", bookable: false, speciesKeys: ["dog"], status: "PUBLISHED" },
      ],
    });
  }

  // Tutor demo pet
  const tutorPets = await prisma.pet.count({ where: { ownerId: tutor.id } });
  if (!tutorPets) {
    const border = await prisma.breed.findFirst({ where: { speciesId: speciesByKey.dog, name: "Border Collie" } });
    await prisma.pet.create({
      data: { name: "Thor", speciesId: speciesByKey.dog!, breedId: border?.id, sex: "MALE", size: "MEDIUM", birthDate: new Date("2023-03-15"), neutered: true, ownerId: tutor.id, color: "Preto e branco" },
    });
    await prisma.address.create({ data: { userId: tutor.id, label: "Casa", zipCode: "80240-000", street: "Av. Sete de Setembro", number: "3000", district: "Batel", city: "Curitiba", state: "PR", latitude: -25.4416, longitude: -49.2883, isPrimary: true } });
    await prisma.phone.create({ data: { userId: tutor.id, number: "+5541988887777", type: "WHATSAPP", isPrimary: true, verifiedAt: new Date() } });
  }

  console.log("Seed done.");
  console.log("Logins (senha: tinypet123): admin@tinypet.local · tutor@tinypet.local · parceiro@tinypet.local");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { randomBytes } from "node:crypto";
import { prisma, Prisma } from "@/db";
import type { z } from "zod";
import type { courseSchema, lessonSchema } from "@tinypet/shared";
import { Errors } from "./errors";
import { assertLimit, assertFeature } from "./plans";
import { notify, notifyPartner } from "./notify";

type CourseInput = z.infer<typeof courseSchema>;
type LessonInput = z.infer<typeof lessonSchema>;

export const courseInclude = {
  category: { select: { id: true, key: true, label: true } },
  modules: { orderBy: { sortOrder: "asc" }, include: { lessons: { orderBy: { sortOrder: "asc" }, include: { attachments: true } } } },
  lessons: { orderBy: { sortOrder: "asc" }, include: { attachments: true } },
  _count: { select: { enrollments: true, lessons: true } },
} satisfies Prisma.CourseInclude;

// ───────────────────────────── partner side ─────────────────────────────

export async function listCourses(partnerId: string) {
  return prisma.course.findMany({ where: { partnerId }, include: courseInclude, orderBy: { createdAt: "desc" } });
}

export async function getCourse(partnerId: string, id: string) {
  const course = await prisma.course.findFirst({ where: { id, partnerId }, include: courseInclude });
  if (!course) throw Errors.notFound("Curso não encontrado");
  return course;
}

async function validateCourseRefs(input: Partial<CourseInput>, partnerId: string) {
  if (input.categoryId) {
    const cat = await prisma.category.findFirst({ where: { id: input.categoryId, active: true } });
    if (!cat) throw Errors.badRequest("Categoria inválida");
  }
  if (input.price != null && input.price > 0) await assertFeature("PARTNER", partnerId, "paid_courses");
}

export async function createCourse(partnerId: string, input: CourseInput) {
  await assertLimit("PARTNER", partnerId, "courses", await prisma.course.count({ where: { partnerId, status: { not: "ARCHIVED" } } }));
  await validateCourseRefs(input, partnerId);
  return prisma.course.create({
    data: {
      partnerId,
      title: input.title,
      description: input.description ?? null,
      coverUrl: input.coverUrl ?? null,
      categoryId: input.categoryId ?? null,
      speciesKeys: input.speciesKeys ?? undefined,
      level: input.level,
      price: input.price ?? null,
      status: input.status ?? "DRAFT",
    },
    include: courseInclude,
  });
}

export async function updateCourse(partnerId: string, id: string, input: Partial<CourseInput>) {
  const current = await getCourse(partnerId, id);
  await validateCourseRefs(input, partnerId);
  // Un-archiving counts against the plan again.
  if (input.status && input.status !== "ARCHIVED" && current.status === "ARCHIVED") {
    await assertLimit("PARTNER", partnerId, "courses", await prisma.course.count({ where: { partnerId, status: { not: "ARCHIVED" } } }));
  }
  if (input.status === "PUBLISHED" && current.status !== "PUBLISHED") {
    const lessons = await prisma.lesson.count({ where: { courseId: id } });
    if (!lessons) throw Errors.badRequest("Adicione ao menos uma aula antes de publicar o curso");
  }
  const data: Prisma.CourseUncheckedUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.coverUrl !== undefined) data.coverUrl = input.coverUrl;
  if (input.categoryId !== undefined) data.categoryId = input.categoryId;
  if (input.speciesKeys !== undefined) data.speciesKeys = input.speciesKeys;
  if (input.level !== undefined) data.level = input.level;
  if (input.price !== undefined) data.price = input.price;
  if (input.status !== undefined) data.status = input.status;
  return prisma.course.update({ where: { id }, data, include: courseInclude });
}

/** Courses have no soft delete: archive when there are enrollments, otherwise remove. */
export async function deleteCourse(partnerId: string, id: string) {
  const course = await getCourse(partnerId, id);
  if (course._count.enrollments > 0) {
    await prisma.course.update({ where: { id }, data: { status: "ARCHIVED" } });
    return { archived: true };
  }
  await prisma.course.delete({ where: { id } });
  return { archived: false };
}

// modules
export async function createModule(partnerId: string, courseId: string, title: string) {
  await getCourse(partnerId, courseId);
  const count = await prisma.courseModule.count({ where: { courseId } });
  return prisma.courseModule.create({ data: { courseId, title, sortOrder: count } });
}

export async function updateModule(partnerId: string, courseId: string, mid: string, input: { title?: string; sortOrder?: number }) {
  const m = await prisma.courseModule.findFirst({ where: { id: mid, courseId, course: { partnerId } } });
  if (!m) throw Errors.notFound("Módulo não encontrado");
  return prisma.courseModule.update({ where: { id: mid }, data: input });
}

export async function deleteModule(partnerId: string, courseId: string, mid: string) {
  const m = await prisma.courseModule.findFirst({ where: { id: mid, courseId, course: { partnerId } } });
  if (!m) throw Errors.notFound("Módulo não encontrado");
  await prisma.lesson.updateMany({ where: { moduleId: mid }, data: { moduleId: null } });
  await prisma.courseModule.delete({ where: { id: mid } });
}

// lessons
export async function listLessons(partnerId: string, courseId: string) {
  await getCourse(partnerId, courseId);
  return prisma.lesson.findMany({ where: { courseId }, include: { attachments: true, module: { select: { id: true, title: true } } }, orderBy: { sortOrder: "asc" } });
}

async function validateLessonModule(courseId: string, moduleId?: string | null) {
  if (!moduleId) return;
  const m = await prisma.courseModule.findFirst({ where: { id: moduleId, courseId } });
  if (!m) throw Errors.badRequest("Módulo não pertence a este curso");
}

export async function createLesson(partnerId: string, courseId: string, input: LessonInput) {
  await getCourse(partnerId, courseId);
  const count = await prisma.lesson.count({ where: { courseId } });
  await assertLimit("PARTNER", partnerId, "lessons_per_course", count);
  await validateLessonModule(courseId, input.moduleId);
  const { attachments, ...rest } = input;
  return prisma.lesson.create({
    data: {
      courseId,
      moduleId: rest.moduleId ?? null,
      title: rest.title,
      description: rest.description ?? null,
      videoUrl: rest.videoUrl ?? null,
      body: rest.body ?? null,
      durationMinutes: rest.durationMinutes ?? null,
      exerciseTitle: rest.exerciseTitle ?? null,
      exerciseRule: rest.exerciseRule ?? undefined,
      sortOrder: rest.sortOrder ?? count,
      attachments: attachments?.length ? { create: attachments.map((a) => ({ name: a.name, url: a.url })) } : undefined,
    },
    include: { attachments: true },
  });
}

export async function updateLesson(partnerId: string, courseId: string, lid: string, input: Partial<LessonInput>) {
  const lesson = await prisma.lesson.findFirst({ where: { id: lid, courseId, course: { partnerId } } });
  if (!lesson) throw Errors.notFound("Aula não encontrada");
  if (input.moduleId !== undefined) await validateLessonModule(courseId, input.moduleId);
  const { attachments, ...rest } = input;
  const data: Prisma.LessonUncheckedUpdateInput = {};
  if (rest.moduleId !== undefined) data.moduleId = rest.moduleId;
  if (rest.title !== undefined) data.title = rest.title;
  if (rest.description !== undefined) data.description = rest.description;
  if (rest.videoUrl !== undefined) data.videoUrl = rest.videoUrl;
  if (rest.body !== undefined) data.body = rest.body;
  if (rest.durationMinutes !== undefined) data.durationMinutes = rest.durationMinutes;
  if (rest.exerciseTitle !== undefined) data.exerciseTitle = rest.exerciseTitle;
  if (rest.exerciseRule !== undefined) data.exerciseRule = rest.exerciseRule === null ? Prisma.JsonNull : rest.exerciseRule;
  if (rest.sortOrder !== undefined) data.sortOrder = rest.sortOrder;
  if (attachments !== undefined) data.attachments = { deleteMany: {}, create: attachments.map((a) => ({ name: a.name, url: a.url })) };
  return prisma.lesson.update({ where: { id: lid }, data, include: { attachments: true } });
}

export async function deleteLesson(partnerId: string, courseId: string, lid: string) {
  const lesson = await prisma.lesson.findFirst({ where: { id: lid, courseId, course: { partnerId } } });
  if (!lesson) throw Errors.notFound("Aula não encontrada");
  await prisma.lesson.delete({ where: { id: lid } });
  // Keep enrollment progress consistent after removing a lesson.
  const enrollments = await prisma.enrollment.findMany({ where: { courseId }, select: { id: true } });
  for (const e of enrollments) await refreshProgress(e.id);
}

/** Contract status is finance data: only returned to members with `canSeeFinance`. */
export async function listStudents(partnerId: string, courseId: string, canSeeFinance = false) {
  await getCourse(partnerId, courseId);
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      pets: { include: { pet: { select: { id: true, name: true, avatarUrl: true } } } },
      progress: { include: { lesson: { select: { id: true, title: true } } } },
      certificate: true,
    },
  });
  if (!canSeeFinance) return enrollments.map(({ contractId: _c, ...e }) => e);
  const contractIds = enrollments.map((e) => e.contractId).filter((id): id is string => !!id);
  const contracts = contractIds.length ? await prisma.contract.findMany({ where: { id: { in: contractIds }, partnerId }, select: { id: true, status: true } }) : [];
  const byId = new Map(contracts.map((c) => [c.id, c]));
  return enrollments.map((e) => ({ ...e, contract: e.contractId ? byId.get(e.contractId) ?? null : null }));
}

// ───────────────────────────── owner side ─────────────────────────────

const enrollmentInclude = {
  course: {
    include: {
      partner: { select: { id: true, tradeName: true, slug: true, logoUrl: true } },
      modules: { orderBy: { sortOrder: "asc" }, include: { lessons: { orderBy: { sortOrder: "asc" }, include: { attachments: true } } } },
      lessons: { orderBy: { sortOrder: "asc" }, include: { attachments: true } },
    },
  },
  pets: { include: { pet: { select: { id: true, name: true, avatarUrl: true } } } },
  progress: true,
  certificate: true,
} satisfies Prisma.EnrollmentInclude;

/**
 * Paid courses stay locked until the enrollment's contract installments are PAID. Free courses (and enrollments made
 * while the course was free, without contract) are unlocked.
 */
async function enrollmentLocked(e: { contractId: string | null }): Promise<boolean> {
  if (!e.contractId) return false;
  const installments = await prisma.installment.findMany({ where: { contractId: e.contractId }, select: { status: true } });
  return !installments.length || installments.some((i) => i.status !== "PAID");
}

type LessonLike = { videoUrl: string | null; body: string | null; attachments: unknown[] };
function lockLesson<L extends LessonLike>(l: L) {
  return { ...l, videoUrl: null, body: null, attachments: [], locked: true as const };
}

type EnrollmentWithCourse = Prisma.EnrollmentGetPayload<{ include: typeof enrollmentInclude }>;

/** Enrollment + the COURSE contract (with installments) when the course was paid; lesson content hidden while locked. */
async function withContract(e: EnrollmentWithCourse) {
  const contract = e.contractId ? await prisma.contract.findUnique({ where: { id: e.contractId }, include: { installments: { orderBy: { number: "asc" } } } }) : null;
  const locked = await enrollmentLocked(e);
  if (!locked) return { ...e, contract, locked: false };
  const course = { ...e.course, lessons: e.course.lessons.map(lockLesson), modules: e.course.modules.map((m) => ({ ...m, lessons: m.lessons.map(lockLesson) })) };
  return { ...e, course, contract, locked: true };
}

/** Pets the user may enroll: owned only (shared accounts are read-only). */
async function assertOwnedPets(userId: string, petIds: string[]) {
  const pets = await prisma.pet.findMany({ where: { id: { in: petIds }, deletedAt: null, status: "ACTIVE", ownerId: userId }, select: { id: true } });
  if (pets.length !== new Set(petIds).size) throw Errors.forbidden("Um dos pets não está na sua conta");
}

/** Finds (or creates) the partner's Client row that represents this user. */
export async function ensureClientForUser(partnerId: string, user: { id: string; name: string; email: string }) {
  const existing = await prisma.client.findFirst({ where: { partnerId, userId: user.id, deletedAt: null } });
  if (existing) return existing;
  return prisma.client.create({ data: { partnerId, userId: user.id, name: user.name, source: "course", emails: { create: { address: user.email, isPrimary: true } } } });
}

export async function enroll(user: { id: string; name: string; email: string }, courseId: string, petIds: string[]) {
  const course = await prisma.course.findFirst({ where: { id: courseId, status: "PUBLISHED", partner: { deletedAt: null } } });
  if (!course) throw Errors.notFound("Curso não encontrado");
  const dup = await prisma.enrollment.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
  if (dup) throw Errors.conflict("Você já está matriculado neste curso");
  await assertOwnedPets(user.id, petIds);

  let contractId: string | null = null;
  const price = course.price != null ? Number(course.price) : 0;
  if (price > 0) {
    const client = await ensureClientForUser(course.partnerId, user);
    const today = new Date(new Date().toISOString().slice(0, 10));
    const contract = await prisma.contract.create({
      data: {
        partnerId: course.partnerId,
        clientId: client.id,
        type: "COURSE",
        title: `Curso: ${course.title}`,
        totalAmount: price,
        discount: 0,
        installmentsCount: 1,
        firstDueDate: today,
        periodicity: "MONTHLY",
        status: "ACTIVE",
        items: { create: [{ description: course.title, quantity: 1, unitPrice: price }] },
        pets: { create: petIds.map((petId) => ({ petId })) },
        installments: { create: [{ number: 1, dueDate: today, amount: price, status: "PENDING" }] },
      },
    });
    contractId = contract.id;
  }

  const enrollment = await prisma.enrollment.create({
    data: { courseId, userId: user.id, contractId, pets: { create: petIds.map((petId) => ({ petId })) } },
    include: enrollmentInclude,
  });
  await notifyPartner(course.partnerId, { type: "COURSE_ENROLL", title: "Novo aluno", body: `${user.name} se matriculou em "${course.title}".`, data: { enrollmentId: enrollment.id, courseId } });
  return withContract(enrollment);
}

export async function listMyEnrollments(userId: string) {
  return prisma.enrollment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      course: { select: { id: true, title: true, coverUrl: true, level: true, price: true, status: true, ratingAvg: true, ratingCount: true, partner: { select: { id: true, tradeName: true, slug: true, logoUrl: true } }, _count: { select: { lessons: true } } } },
      pets: { include: { pet: { select: { id: true, name: true, avatarUrl: true } } } },
      certificate: true,
    },
  });
}

export async function getMyEnrollment(userId: string, enrollmentId: string) {
  const e = await prisma.enrollment.findFirst({ where: { id: enrollmentId, userId }, include: enrollmentInclude });
  if (!e) throw Errors.notFound("Matrícula não encontrada");
  return withContract(e);
}

function certificateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Recomputes progressPct; at 100% issues the Certificate and a PetHistoryEvent ACHIEVEMENT per pet. */
async function refreshProgress(enrollmentId: string) {
  const e = await prisma.enrollment.findUnique({ where: { id: enrollmentId }, include: { course: { select: { id: true, title: true, partnerId: true } }, pets: true, certificate: true } });
  if (!e) return null;
  const [total, done] = await Promise.all([
    prisma.lesson.count({ where: { courseId: e.courseId } }),
    prisma.lessonProgress.count({ where: { enrollmentId, completedAt: { not: null }, lesson: { courseId: e.courseId } } }),
  ]);
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const completed = total > 0 && done >= total;
  await prisma.enrollment.update({ where: { id: enrollmentId }, data: { progressPct: pct, completedAt: completed ? e.completedAt ?? new Date() : null } });

  if (completed && !e.certificate) {
    const cert = await prisma.certificate.create({ data: { enrollmentId, courseId: e.courseId, code: certificateCode() } });
    const now = new Date();
    for (const p of e.pets) {
      await prisma.petHistoryEvent.create({
        data: { petId: p.petId, type: "ACHIEVEMENT", title: `Concluiu o curso "${e.course.title}"`, description: `Certificado ${cert.code}`, occurredAt: now, partnerId: e.course.partnerId, userId: e.userId },
      });
    }
    await notify({ userId: e.userId, type: "COURSE_COMPLETED", title: "Curso concluído!", body: `Você concluiu "${e.course.title}". Seu certificado está disponível.`, data: { enrollmentId, certificateId: cert.id } });
  }
  return pct;
}

export async function updateLessonProgress(user: { id: string; name: string }, enrollmentId: string, lessonId: string, input: { completed?: boolean; question?: string | null }) {
  const e = await prisma.enrollment.findFirst({ where: { id: enrollmentId, userId: user.id }, include: { pets: true, course: { select: { id: true, title: true, partnerId: true } } } });
  if (!e) throw Errors.notFound("Matrícula não encontrada");
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, courseId: e.courseId } });
  if (!lesson) throw Errors.notFound("Aula não encontrada");
  if (await enrollmentLocked(e)) throw Errors.forbidden("Conclua o pagamento do curso para acessar as aulas");

  const existing = await prisma.lessonProgress.findUnique({ where: { enrollmentId_lessonId: { enrollmentId, lessonId } } });
  const data: Prisma.LessonProgressUncheckedUpdateInput = {};
  if (input.completed !== undefined) data.completedAt = input.completed ? existing?.completedAt ?? new Date() : null;
  if (input.question !== undefined) data.question = input.question;
  const progress = existing
    ? await prisma.lessonProgress.update({ where: { id: existing.id }, data })
    : await prisma.lessonProgress.create({ data: { enrollmentId, lessonId, completedAt: input.completed ? new Date() : null, question: input.question ?? null } });

  // Exercise → proposed Task for each enrolled pet (once per pet/lesson).
  const newlyCompleted = input.completed && !existing?.completedAt;
  if (newlyCompleted && lesson.exerciseRule) {
    for (const p of e.pets) {
      const dup = await prisma.task.findFirst({ where: { petId: p.petId, lessonId } });
      if (dup) continue;
      await prisma.task.create({
        data: {
          petId: p.petId,
          title: lesson.exerciseTitle ?? `Exercício: ${lesson.title}`,
          description: lesson.description ?? null,
          rule: lesson.exerciseRule as Prisma.InputJsonValue,
          status: "PROPOSED",
          proposedByPartnerId: e.course.partnerId,
          lessonId,
        },
      });
    }
  }
  if (input.question) {
    await notifyPartner(e.course.partnerId, { type: "COURSE_QUESTION", title: "Nova dúvida em aula", body: `${user.name} perguntou em "${lesson.title}" (${e.course.title}).`, data: { enrollmentId, lessonId } });
  }

  const progressPct = await refreshProgress(enrollmentId);
  return { ...progress, progressPct };
}

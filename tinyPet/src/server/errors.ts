export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const Errors = {
  unauthorized: (msg = "Faça login para continuar") => new ApiError(401, "UNAUTHORIZED", msg),
  forbidden: (msg = "Sem permissão") => new ApiError(403, "FORBIDDEN", msg),
  notFound: (msg = "Não encontrado") => new ApiError(404, "NOT_FOUND", msg),
  badRequest: (msg = "Requisição inválida", details?: unknown) => new ApiError(400, "BAD_REQUEST", msg, details),
  conflict: (msg = "Conflito") => new ApiError(409, "CONFLICT", msg),
  planLimit: (details: { featureKey: string; current: number; limit: number | null; planKey: string }) =>
    new ApiError(402, "PLAN_LIMIT", "Limite do plano atingido. Faça upgrade para continuar.", details),
  rateLimited: () => new ApiError(429, "RATE_LIMITED", "Muitas tentativas. Tente novamente em instantes."),
};

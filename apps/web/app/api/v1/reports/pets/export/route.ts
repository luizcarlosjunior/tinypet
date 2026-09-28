import { petReportQuery } from "@tinypet/shared";
import { handler, parseQuery } from "@/server";
import { petReportCsv, reportMode } from "@/server/reports";
import { csvResponse } from "@/server/csv";
import { todaySP } from "@/server/pets";

export const GET = handler(async (req) => {
  const mode = await reportMode(req);
  const q = parseQuery(req, petReportQuery);
  return csvResponse(await petReportCsv(mode, q), `relatorio-pets-${todaySP()}.csv`);
});

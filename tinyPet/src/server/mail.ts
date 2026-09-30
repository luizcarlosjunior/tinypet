import nodemailer from "nodemailer";

const transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;

/** Escapes text for safe interpolation into HTML (element content and quoted attributes). */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Plain text → escaped HTML paragraph content (keeps line breaks). */
export function textToHtml(text: string) {
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

export async function sendMail(to: string, subject: string, html: string, text?: string) {
  const from = process.env.EMAIL_FROM ?? "tinyPet <no-reply@tinypet.local>";
  // Header injection guard: nodemailer already rejects CR/LF in addresses, but keep subjects single-line.
  const safeSubject = subject.replace(/[\r\n]+/g, " ").slice(0, 150); // names in subjects (trade names) are user-controlled
  if (!transport) {
    if (process.env.NODE_ENV === "production") {
      console.warn(`[mail] SMTP not configured, dropped message to ${to.split("@")[1] ?? "unknown"}`);
    } else {
      console.log(`[mail][dev] to=${to} subject="${safeSubject}"\n${text ?? html}`);
    }
    return;
  }
  await transport.sendMail({ from, to, subject: safeSubject, html, text });
}

/**
 * Wraps a message in the tinyPet e-mail layout. `title` is plain text (escaped here).
 * `body` is trusted HTML: callers MUST escape any user-provided value with escapeHtml().
 */
export function layout(title: string, body: string) {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#242833">
  <h2 style="color:#f95d16;margin:0 0 16px">tinyPet</h2>
  <h3 style="margin:0 0 12px">${escapeHtml(title)}</h3>
  <div style="font-size:15px;line-height:1.5">${body}</div>
  <p style="font-size:12px;color:#8792a8;margin-top:24px">Você recebeu este e-mail porque tem uma conta ou foi convidado no tinyPet.</p>
</div>`;
}

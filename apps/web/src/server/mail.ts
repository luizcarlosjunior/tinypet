import nodemailer from "nodemailer";

const transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;

export async function sendMail(to: string, subject: string, html: string, text?: string) {
  const from = process.env.EMAIL_FROM ?? "tinyPet <no-reply@tinypet.local>";
  if (!transport) {
    console.log(`[mail] to=${to} subject="${subject}"\n${text ?? html}`);
    return;
  }
  await transport.sendMail({ from, to, subject, html, text });
}

export function layout(title: string, body: string) {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#242833">
  <h2 style="color:#f95d16;margin:0 0 16px">tinyPet</h2>
  <h3 style="margin:0 0 12px">${title}</h3>
  <div style="font-size:15px;line-height:1.5">${body}</div>
  <p style="font-size:12px;color:#8792a8;margin-top:24px">Você recebeu este e-mail porque tem uma conta ou foi convidado no tinyPet.</p>
</div>`;
}

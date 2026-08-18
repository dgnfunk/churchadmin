import nodemailer from "nodemailer";

export async function sendOperationalEmail(input: { to: string[]; subject: string; text: string }) {
  if (!input.to.length || !process.env.SMTP_HOST || !process.env.SMTP_FROM) return false;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  await transport.sendMail({ from: process.env.SMTP_FROM, to: input.to, subject: input.subject, text: input.text });
  return true;
}

import nodemailer from "nodemailer";

const hasSmtpConfig = Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
);

const transporter = hasSmtpConfig
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

interface ISendMailParams {
  to: string;
  subject: string;
  text: string;
}

// без SMTP просто логируем письмо
export const sendMail = async ({ to, subject, text }: ISendMailParams) => {
  if (!transporter) {
    console.warn(
      `[mailer] SMTP is not configured (set SMTP_HOST/SMTP_USER/SMTP_PASS in .env) — email was not sent.\nTo: ${to}\nSubject: ${subject}\n\n${text}`,
    );
    return;
  }

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
};

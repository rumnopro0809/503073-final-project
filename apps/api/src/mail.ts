import nodemailer from 'nodemailer';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { traceMailjetDelivery } from './mailjetTrace.js';

export type SendVerification = (email: string, activationUrl: string) => Promise<void>;

async function sendAccountMail(email: string, subject: string, text: string) {
  if (config.mailTransport === 'disabled') throw new Error('Email delivery is not configured on this deployment.');
  const mailjet = process.env.SMTP_HOST?.trim().toLowerCase() === 'in-v3.mailjet.com';
  const traceId = mailjet ? randomUUID() : undefined;
  const message = {
    from: config.mailFrom, to: email, subject, text,
    ...(traceId ? {headers:{'X-MJ-CustomID':traceId}} : {}),
  };
  if (config.mailTransport === 'file') {
    const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    const result = await transporter.sendMail(message);
    await mkdir(config.mailDir, { recursive: true });
    const filename = `${Date.now()}-${randomUUID()}`;
    await writeFile(path.join(config.mailDir, `${filename}.eml`), result.message);
    await writeFile(path.join(config.mailDir, `${filename}.txt`), `To: ${email}\nSubject: ${message.subject}\n\n${message.text}`, 'utf8');
    console.info('Development email saved in .data/mail (not delivered to a real inbox).');
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    requireTLS: config.production && process.env.SMTP_SECURE !== 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  });
  try {
    const result = await transporter.sendMail(message);
    const accepted = (result.accepted ?? []).some((recipient: string | {address?: string}) =>
      (typeof recipient === 'string' ? recipient : recipient.address ?? '').toLowerCase() === email.toLowerCase());
    if (!accepted) throw Object.assign(new Error('SMTP did not accept the recipient.'), {code:'ERECIPIENT'});
    console.info('SMTP_ACCEPTED: recipient accepted by relay; inbox delivery is not yet confirmed.');
    if (traceId) {
      console.info('MAILJET_SUBMITTED', {traceId});
      // Allow time for indexing. This lookup cannot turn an accepted send into a failure.
      setTimeout(() => {void traceMailjetDelivery(traceId);}, 15_000).unref();
    }
  } catch (failure) {
    const error = failure as {code?: unknown; responseCode?: unknown};
    // Never log SMTP credentials, reset/activation URLs, recipient addresses or raw server responses.
    const code = typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : 'UNKNOWN';
    const responseCode = typeof error.responseCode === 'number' ? error.responseCode : null;
    console.error('SMTP_FAILED', {code, responseCode});
    throw failure;
  }
}

export const sendVerification: SendVerification = (email, activationUrl) => sendAccountMail(email, 'Xác minh tài khoản Ghi chú',
  `Chào bạn,\n\nNhấn liên kết dưới đây để xác minh tài khoản Ghi chú:\n${activationUrl}\n\nLiên kết có hiệu lực trong 24 giờ. Bạn vẫn có thể dùng ứng dụng trước khi xác minh.\nNếu không đăng ký tài khoản, bạn có thể bỏ qua thư này.`);
export const sendPasswordReset: SendVerification = (email, url) => sendAccountMail(email, 'Đặt lại mật khẩu Ghi chú',
  `Chào bạn,\n\nMở liên kết dưới đây để đặt lại mật khẩu:\n${url}\n\nLiên kết chỉ dùng một lần, có hiệu lực 30 phút. Nếu không yêu cầu đặt lại, hãy bỏ qua email này. Mật khẩu hiện tại vẫn giữ nguyên cho đến khi bạn hoàn tất đặt lại.`);

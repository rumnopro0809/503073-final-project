import nodemailer from 'nodemailer';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';

export type SendVerification = (email: string, activationUrl: string) => Promise<void>;

async function sendAccountMail(email: string, subject: string, text: string) {
  const message = {
    from: config.mailFrom, to: email, subject, text,
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
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  });
  await transporter.sendMail(message);
}

export const sendVerification: SendVerification = (email, activationUrl) => sendAccountMail(email, 'Xác minh tài khoản Ghi chú',
  `Chào bạn,\n\nNhấn liên kết dưới đây để xác minh tài khoản Ghi chú:\n${activationUrl}\n\nLiên kết có hiệu lực trong 24 giờ. Bạn vẫn có thể dùng ứng dụng trước khi xác minh.\nNếu không đăng ký tài khoản, bạn có thể bỏ qua thư này.`);
export const sendPasswordReset: SendVerification = (email, url) => sendAccountMail(email, 'Đặt lại mật khẩu Ghi chú',
  `Chào bạn,\n\nMở liên kết dưới đây để đặt lại mật khẩu:\n${url}\n\nLiên kết chỉ dùng một lần, có hiệu lực 30 phút. Nếu không yêu cầu đặt lại, hãy bỏ qua email này. Mật khẩu hiện tại vẫn giữ nguyên cho đến khi bạn hoàn tất đặt lại.`);

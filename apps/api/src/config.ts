import 'dotenv/config';
import path from 'node:path';

export const config = {
  production: process.env.NODE_ENV === 'production',
  host: process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
  port: Number(process.env.PORT || process.env.API_PORT || 3001),
  appUrl: process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.WEB_PORT || 5173}`,
  databaseUrl: process.env.DATABASE_URL || '',
  dataDir: path.resolve(process.env.DATA_DIR || '.data/postgres'),
  mailDir: path.resolve('.data/mail'),
  mailTransport: process.env.MAIL_TRANSPORT || 'file',
  mailFrom: process.env.MAIL_FROM || 'NoteNgay <no-reply@example.test>',
  trustProxy: process.env.TRUST_PROXY === 'true',
};

export function validateConfig() {
  const url = new URL(config.appUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('APP_URL must use HTTP or HTTPS.');
  if (!['file','smtp','disabled'].includes(config.mailTransport)) throw new Error('Unsupported MAIL_TRANSPORT.');
  if (config.production && (!config.databaseUrl || !['smtp','disabled'].includes(config.mailTransport) || url.protocol !== 'https:')) {
    throw new Error('Production requires DATABASE_URL, SMTP or explicitly disabled mail, and an HTTPS APP_URL.');
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('Invalid server port.');
  if (config.mailTransport === 'smtp' && !process.env.SMTP_HOST) throw new Error('SMTP_HOST is required.');
}

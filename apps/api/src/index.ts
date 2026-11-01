import path from 'node:path';
import { config, validateConfig } from './config.js';
import { openDatabase, migrate } from './database.js';
import { createApp } from './app.js';
import { sendVerification, sendPasswordReset } from './mail.js';
import { attachRealtime } from './realtime.js';
import {geminiSummarizer} from './summary.js';
import {geminiAnswerer} from './questions.js';

validateConfig();
const db = await openDatabase({ url: config.databaseUrl, directory: config.dataDir });
await migrate(db);
const app = createApp({ db, appUrl: config.appUrl, production: config.production, sendVerification, sendPasswordReset,
  trustProxy: config.trustProxy, webDir: config.production ? path.resolve('build/web') : undefined,
  summarize:process.env.GEMINI_API_KEY?geminiSummarizer(process.env.GEMINI_API_KEY,process.env.GEMINI_MODEL||'gemini-3.1-flash-lite'):undefined,
  answerQuestion:process.env.GEMINI_API_KEY?geminiAnswerer(process.env.GEMINI_API_KEY,process.env.GEMINI_MODEL||'gemini-3.1-flash-lite'):undefined });
const server = app.listen(config.port, config.host, () => {
  console.info(`API ready at http://${config.host}:${config.port}`);
  console.info(config.databaseUrl ? 'Database: PostgreSQL server' : 'Database: embedded PostgreSQL (.data/postgres)');
  console.info(`Mail transport: ${config.mailTransport}; SMTP port: ${Number(process.env.SMTP_PORT || 587)}; credentials configured: ${Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)}`);
});
let stopping = false;
const closeRealtime=attachRealtime(server,db,config.appUrl);
async function shutdown() {
  if (stopping) return;
  stopping = true;
  closeRealtime();
  server.close(async () => { await db.close(); process.exit(0); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

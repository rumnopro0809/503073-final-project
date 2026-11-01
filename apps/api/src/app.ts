import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'node:path';
import { authRouter, type AuthOptions } from './auth.js';
import { notesRouter } from './notes.js';
import { labelsRouter } from './labels.js';
import { attachmentsRouter } from './attachments.js';
import {summaryRouter,type Summarize} from './summary.js';
import {questionRouter,type AnswerQuestion} from './questions.js';

export function createApp(options: AuthOptions & { trustProxy?: boolean; webDir?: string; summarize?:Summarize; answerQuestion?:AnswerQuestion }) {
  const app = express();
  app.disable('x-powered-by');
  if (options.trustProxy) app.set('trust proxy', 1);
  app.use(helmet({ strictTransportSecurity: options.production ? undefined : false }));
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const origin = req.get('origin');
      // Custom header + JSON prevents cross-site forms; CORS is intentionally not enabled.
      if ((origin && origin !== new URL(options.appUrl).origin) || req.get('x-requested-with') !== 'GhiChu' || !req.is('application/json')) {
        res.status(403).json({ message: 'Yêu cầu không hợp lệ. Vui lòng tải lại trang và thử lại.' }); return;
      }
    }
    next();
  });
  app.use('/api/notes', express.json({ limit: '1mb' }));
  app.use('/api/auth/avatar', express.json({ limit: '3mb' }));
  app.use('/api/attachments', express.json({ limit: '15mb' }));
  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRouter(options));
  app.use('/api/notes', notesRouter(options.db));
  app.use('/api/notes', summaryRouter(options.db,options.summarize,options.rateLimit!==false));
  app.use('/api/labels', labelsRouter(options.db));
  app.use('/api/attachments', attachmentsRouter(options.db));
  app.use('/api/ai',questionRouter(options.db,options.answerQuestion,options.rateLimit!==false));
  app.use('/api', (_req, res) => res.status(404).json({ message: 'Không tìm thấy yêu cầu này.' }));
  if (options.webDir) {
    app.use(express.static(options.webDir));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(options.webDir!, 'index.html')));
  }
  app.use((error: { type?: string; status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error.type === 'entity.parse.failed') { res.status(400).json({ message: 'Dữ liệu gửi lên không hợp lệ.' }); return; }
    if (error.status === 413) { res.status(413).json({ message: 'Dữ liệu gửi lên quá lớn.' }); return; }
    console.error('Request failed:', error);
    res.status(500).json({ message: 'Máy chủ gặp sự cố. Bạn vui lòng thử lại sau.' });
  });
  return app;
}

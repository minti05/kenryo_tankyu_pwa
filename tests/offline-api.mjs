// HTTP fixture for service-worker browsers. Included only in isolated test preview middleware.
import { createHash } from 'node:crypto';
import { fixturePdf } from './pdf-fixture.mjs';
const bytes = fixturePdf(),
  sha = createHash('sha256').update(bytes).digest('hex');
const work = {
  contractVersion: '1',
  documentID: '24000010',
  title: '架空のオフライン作品',
  author: '架空班',
  enterYear: 2024,
  course: 'tankyu',
  eventName: 'individualTankyu',
  category1: 'society',
  subCategory1: 'disasterPrevention',
  category2: 'none',
  subCategory2: 'none',
  existsPoster: true,
  existsReport: true,
  existsSlide: false,
  existsThesis: false,
  revision: 'fixture-r1',
};
export function offlineApi() {
  const states = new Map();
  return {
    name: 'offline-http-fixture',
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        if (!path?.startsWith('/api/') && path !== '/__offline-fixture') return next();
        const cookie = /offline-test=([^;]+)/.exec(req.headers.cookie ?? '')?.[1] ?? 'none';
        let state = states.get(cookie);
        if (!state) {
          state = { status: 200, rev: 'a'.repeat(64), calls: [], push: null, noticeRead: false };
          states.set(cookie, state);
        }
        function json(body, status = 200) {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(body));
        }
        if (path === '/__offline-fixture') {
          if (req.method === 'POST') {
            let text = '';
            for await (const chunk of req) text += chunk;
            const value = JSON.parse(text);
            if (value.status) state.status = value.status;
            if (value.deleteResponseFail) state.deleteResponseFail = true;
            if (value.rev) state.rev = value.rev;
          }
          return json(state);
        }
        state.calls.push(req.method + ' ' + path);
        if (req.headers.authorization !== 'Bearer fixture-token')
          return json({ error: { code: 'session_expired' } }, 401);
        if (state.status !== 200)
          return json(
            {
              error: {
                code: state.status === 403 ? 'membership_required' : 'firestore_unavailable',
              },
            },
            state.status,
          );
        if (path === '/api/account-deletion') {
          if (req.method === 'POST') {
            let text = '';
            for await (const chunk of req) text += chunk;
            state.deletion = JSON.parse(text).operationId;
            if (state.deleteResponseFail) {
              state.deleteResponseFail = false;
              return json({ error: { code: 'upstream_unavailable' } }, 503);
            }
          }
          return state.deletion
            ? json({ version: '1', id: state.deletion, status: 'pending' })
            : json({ error: { code: 'not_found' } }, 404);
        }
        if (path === '/api/push-subscriptions') {
          if (req.method === 'PUT') {
            let text = '';
            for await (const c of req) text += c;
            state.push = JSON.parse(text);
          }
          if (req.method === 'DELETE') state.push = null;
          return json(
            req.method === 'GET'
              ? { version: '1', enabled: true, registered: !!state.push }
              : { version: '1', ok: true },
          );
        }
        const notice = {
          id: '11111111-1111-4111-8111-111111111111',
          title: '架空のお知らせ',
          body: 'これは通知の試験です。',
          createdAt: '2026-10-18T00:00:00Z',
          read: state.noticeRead,
          workId: null,
        };
        if (path === '/api/notifications')
          return json({ version: '1', items: [notice], nextCursor: null });
        if (path === '/api/notifications/' + notice.id) return json(notice);
        if (path === '/api/notification-reads/' + notice.id) {
          state.noticeRead = true;
          return json({ version: '1', ok: true });
        }
        if (path === '/api/session')
          return json({ version: '1', uid: 'fixture-alice', role: 'student' });
        if (path === '/api/works/24000010')
          return json({
            version: '1',
            authorizedAt: new Date().toISOString(),
            work,
            documents: ['poster', 'report'].map((kind) => ({
              kind,
              state: 'available',
              bytes: bytes.length,
              revision: state.rev,
              sha256: sha,
            })),
          });
        if (path.includes('/pdf/')) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Length', String(bytes.length));
          res.setHeader('X-Document-Revision', state.rev);
          res.setHeader('X-Content-SHA256', sha);
          res.setHeader('X-Authorized-At', new Date().toISOString());
          res.setHeader('Cache-Control', 'private, no-store');
          return res.end(req.method === 'HEAD' ? undefined : bytes);
        }
        json({ version: '1', items: [], nextCursor: null });
      });
    },
  };
}

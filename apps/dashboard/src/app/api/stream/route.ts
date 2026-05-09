import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let lastId = 0;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const interval = setInterval(() => {
        const db = getDb();
        if (!db) return;

        try {
          const rows = db.prepare(
            'SELECT * FROM execution_log WHERE id > ? ORDER BY id ASC LIMIT 50'
          ).all(lastId) as Array<{ id: number }>;

          for (const row of rows) {
            send(row);
            lastId = row.id;
          }
        } catch {
          // silently skip — stream will resume next tick
        }
      }, 1000);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

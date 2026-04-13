export const config = { runtime: 'edge' };

export default function handler(req: Request) {
  return new Response(
    JSON.stringify({
      ok: true,
      hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
      hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
      runtime: 'edge',
      time: new Date().toISOString()
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

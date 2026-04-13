module.exports = function handler(req, res) {
  res.status(200).json({
    ok: true,
    hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
    hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
    node: process.version,
    time: new Date().toISOString(),
  });
};

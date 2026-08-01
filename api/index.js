export default async function handler(req, res) {
  try {
    const { default: app } = await import('../backend/src/app.js');
    const { connectDB } = await import('../backend/src/config/db.js');

    await connectDB();
    return app(req, res);
  } catch (err) {
    console.error('Serverless function error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}

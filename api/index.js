import app from '../backend/src/app.js';
import { connectDB } from '../backend/src/config/db.js';

export default async function handler(req, res) {
  try {
    await connectDB();
  } catch (err) {
    console.error('Failed to connect DB in serverless handler:', err);
  }
  return app(req, res);
}

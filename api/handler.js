import app from './index.js';

// Vercel serverless function wrapper
export default async (req, res) => {
  // Let Express handle the request
  return app(req, res);
};
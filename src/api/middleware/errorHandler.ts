import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[API Error]', err.message || err);

  const status = err.status || err.statusCode || 500;
  const message = status >= 500
    ? 'Internal server error'
    : (err.message || 'An error occurred');
  res.status(status).json({ error: message });
}

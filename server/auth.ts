// Авторизация: bcrypt + JWT, middleware для Express
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'animeworld-dev-secret-change-me-in-production';
const JWT_EXPIRES = '30d';

const AVATAR_COLORS = [
  '#ec4899', // розовый - основной цвет
];

export interface UserPayload {
  id: number;
  username: string;
  avatarColor: string;
  isAdmin: boolean;
  canUpload: boolean;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(user: UserPayload): string {
  return jwt.sign(user as any, JWT_SECRET, { expiresIn: JWT_EXPIRES } as any);
}

export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

export function getRandomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload | null;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const token = (req as any).cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    req.user = null;
    return next();
  }
  req.user = verifyToken(token);
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });
  next();
}

export function requireUploadPermission(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Требуется авторизация' });
  if (!req.user.canUpload && !req.user.isAdmin) {
    return res.status(403).json({ error: 'У вас нет прав на загрузку видео' });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Требуются права администратора' });
  }
  next();
}
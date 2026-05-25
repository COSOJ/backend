import { Request } from 'express';

interface AuthenticatedUser {
  userId?: string | { toString(): string };
  _id?: string | { toString(): string };
  roles?: string[];
  handle?: string;
  [key: string]: unknown;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

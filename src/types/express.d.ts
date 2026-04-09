import { Request } from 'express';

interface AuthenticatedUser {
  userId?: string;
  _id?: string;
  roles?: string[];
  handle?: string;
  [key: string]: unknown;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

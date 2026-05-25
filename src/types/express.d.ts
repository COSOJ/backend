import { Request } from 'express';

type IdLike = string | { toString(): string };

interface AuthenticatedUser {
  userId?: IdLike;
  _id?: IdLike;
  roles?: string[];
  handle?: string;
  [key: string]: unknown;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

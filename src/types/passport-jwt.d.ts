declare module 'passport-jwt' {
  import type { Request } from 'express';
  import type { Strategy as PassportStrategyBase } from 'passport-strategy';

  export type JwtFromRequestFunction<T = Request> = (
    req: T,
  ) => string | null;

  export interface StrategyOptions {
    jwtFromRequest: JwtFromRequestFunction;
    secretOrKey: string;
    passReqToCallback?: boolean;
  }

  export class Strategy extends PassportStrategyBase {
    constructor(options: StrategyOptions, verify?: (...args: unknown[]) => void);
  }

  export const ExtractJwt: {
    fromAuthHeaderAsBearerToken(): JwtFromRequestFunction;
    fromExtractors(
      extractors: JwtFromRequestFunction[],
    ): JwtFromRequestFunction;
  };
}

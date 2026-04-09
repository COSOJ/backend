import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const cookies = (req as Request & { cookies?: Record<string, unknown> })
            .cookies;
          const refreshToken = cookies?.refreshToken;
          return typeof refreshToken === 'string' ? refreshToken : null;
        },
      ]),
      secretOrKey: process.env.REFRESH_TOKEN_SECRET || 'refresh_secret',
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: { userId: string; roles: string[] }) {
    return { userId: payload.userId, roles: payload.roles };
  }
}

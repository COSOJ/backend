import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { appConfig } from '../config/app.config';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const cookieHeader = req.headers.cookie;
          if (!cookieHeader) {
            return null;
          }

          const tokenPair = cookieHeader
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith('refreshToken='));

          if (!tokenPair) {
            return null;
          }

          return tokenPair.slice('refreshToken='.length) || null;
        },
      ]),
      secretOrKey: appConfig.jwt.refreshSecret,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: { userId: string; roles: string[] }) {
    return { userId: payload.userId, roles: payload.roles };
  }
}

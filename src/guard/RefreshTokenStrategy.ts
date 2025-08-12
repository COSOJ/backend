import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.refreshToken,
      ]),
      secretOrKey: process.env.REFRESH_TOKEN_SECRET || 'refresh_secret',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { userId: string, roles: string[] }) {
    return { userId: payload.userId, roles: payload.roles };
  }
}

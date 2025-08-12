import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // expects "Authorization: Bearer <token>"
      secretOrKey: process.env.JWT_SECRET || 'access_secret',
    });
  }

  async validate(payload: { userId: string }) {
    return { userId: payload.userId };
  }
}

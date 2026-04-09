import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request } from 'express';
import { User } from '../schema/User';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => {
          const cookieHeader = req.headers.cookie;
          if (!cookieHeader) {
            return null;
          }

          const tokenPair = cookieHeader
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith('accessToken='));

          if (!tokenPair) {
            return null;
          }

          return tokenPair.slice('accessToken='.length) || null;
        },
      ]),
      secretOrKey: process.env.JWT_SECRET || 'access_secret',
    });
  }

  async validate(payload: { userId: string; roles: string[] }) {
    const user = await this.userModel
      .findById(payload.userId)
      .select('-passwordHash');
    if (!user) {
      throw new UnauthorizedException();
    }
    // Return user with roles from JWT payload to ensure they're available
    return { ...user.toObject(), roles: payload.roles };
  }
}

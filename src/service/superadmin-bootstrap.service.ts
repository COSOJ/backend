import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schema/User';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SuperAdminBootstrapService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>
  ) {}

  async onApplicationBootstrap() {
    const handle = 'superadmin';
    const email = 'superadmin@example.com';
    const password = 'supersecurepassword';
    const passwordHash = await bcrypt.hash(password, 10);

    let user = await this.userModel.findOne({ handle });
    if (!user) {
      user = await this.userModel.create({
        handle,
        email,
        passwordHash,
        roles: ['superadmin'],
        rating: 2000,
      });
      Logger.log('Superadmin user created:', 'Bootstrap');
    } else {
      Logger.log('Superadmin user already exists:', 'Bootstrap');
    }
    console.log(user);
  }
}

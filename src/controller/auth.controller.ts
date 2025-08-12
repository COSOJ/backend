import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import { LoginDto } from 'src/dto/auth/login.dto';
import { RegisterDto } from 'src/dto/auth/register.dto';
import { JwtAuthGuard } from 'src/guard/JwtAuthGuard';
import { RefreshTokenGuard } from 'src/guard/RefreshTokenGuard';
import { AuthService } from 'src/service/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.register(dto);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict' });
    return { accessToken, user };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.login(dto);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict' });
    return { accessToken, user };
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
  const { accessToken, refreshToken } = await this.authService.refreshTokens(req.user!['userId'], req.cookies.refreshToken);
    res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict' });
    return { accessToken };
  }

  @Get('check-handle')
  async checkHandle(@Body('handle') handle: string) {
    return this.authService.isHandleAvailable(handle);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    return req.user;
  }
}

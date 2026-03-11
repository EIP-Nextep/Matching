import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private jwtService: JwtService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const token = request.headers.authorization?.split(' ')[1];

        if (!token) throw new UnauthorizedException('Token manquant');

        try {
            const payload = await this.jwtService.verifyAsync<
                Record<string, unknown>
            >(token, {
                secret: process.env.JWT_SECRET,
            });
            (request as any)['user'] = payload;
        } catch {
            throw new UnauthorizedException('Token invalide');
        }
        return true;
    }
}

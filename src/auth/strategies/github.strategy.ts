import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config'; // Recommended to use ConfigService

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
    constructor(private configService: ConfigService) {
        super({
            // The '!' tells TS these will definitely be strings at runtime
            clientID: configService.get<string>('GITHUB_CLIENT_ID')!,
            clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET')!,
            callbackURL: 'https://ecommerce-backend-cqoc.vercel.app/api/auth/callback/github',
            scope: ['user:email'],
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: any) {
        const { username, emails, photos } = profile;
        return {
            email: emails[0].value,
            name: username,
            picture: photos[0].value,
            accessToken,
        };
    }
}
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
    constructor(configService: ConfigService) {
        const clientID = configService.get<string>('GITHUB_CLIENT_ID');
        const clientSecret = configService.get<string>('GITHUB_CLIENT_SECRET');
        const callbackURL = configService.get<string>('GITHUB_CALLBACK_URL');

        if (!clientID || !clientSecret || !callbackURL) {
            throw new Error(
                'Missing GitHub OAuth config. Set GITHUB_CLIENT_ID, ' +
                'GITHUB_CLIENT_SECRET, and GITHUB_CALLBACK_URL in your environment.',
            );
        }

        super({ clientID, clientSecret, callbackURL, scope: ['user:email'] });
    }

    async validate(accessToken: string, _refreshToken: string, profile: any) {
        return {
            email: profile.emails?.[0]?.value ?? null,
            name: profile.username,
            picture: profile.photos?.[0]?.value ?? null,
            accessToken,
        };
    }
}
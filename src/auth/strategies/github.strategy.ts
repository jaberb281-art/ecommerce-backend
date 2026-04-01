import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config'; // Recommended to use ConfigService

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
    // src/auth/strategies/github.strategy.ts
    constructor() {
        super({
            clientID: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            callbackURL: process.env.GITHUB_CALLBACK_URL!,
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
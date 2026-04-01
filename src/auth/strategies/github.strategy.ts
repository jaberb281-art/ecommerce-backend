import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
    // src/auth/strategies/github.strategy.ts
    constructor() {
        super({
            clientID: 'Ov23liwh0pUPL1zRXa7y',
            clientSecret: '25d22fec2e3cd8d3fa080d72c7ce8a13b64c01ed',
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
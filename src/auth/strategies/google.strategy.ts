import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(configService: ConfigService) {
        const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
        const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
        const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

        if (!clientID || !clientSecret || !callbackURL) {
            throw new Error(
                'Missing Google OAuth config. Set GOOGLE_CLIENT_ID, ' +
                'GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL in your environment.',
            );
        }

        super({
            clientID,
            clientSecret,
            callbackURL,
            scope: ['email', 'profile'],
        });
    }

    async validate(
        _accessToken: string,
        _refreshToken: string,
        profile: any,
        done: VerifyCallback,
    ) {
        const user = {
            email: profile.emails?.[0]?.value ?? null,
            name: profile.displayName ?? profile.name?.givenName ?? 'User',
            picture: profile.photos?.[0]?.value ?? null,
        };
        done(null, user);
    }
}
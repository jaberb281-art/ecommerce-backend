import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

export const CloudinaryProvider = {
    provide: 'CLOUDINARY',
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => {
        const cloudName = configService.get<string>('CLOUDINARY_CLOUD_NAME');
        const apiKey = configService.get<string>('CLOUDINARY_API_KEY');
        const apiSecret = configService.get<string>('CLOUDINARY_API_SECRET');

        // Crash on startup if any Cloudinary credentials are missing
        if (!cloudName || !apiKey || !apiSecret) {
            throw new Error(
                'Missing Cloudinary credentials. Ensure CLOUDINARY_CLOUD_NAME, ' +
                'CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set in your .env file.',
            );
        }

        return cloudinary.config({
            cloud_name: cloudName,
            api_key: apiKey,
            api_secret: apiSecret,
        });
    },
};
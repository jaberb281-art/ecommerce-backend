import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import path from 'path';

const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/octet-stream', // Next.js server actions lose MIME type — validate by extension instead
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const IMAGE_UPLOAD_OPTIONS = {
    storage: memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter: (
        _req: any,
        file: Express.Multer.File,
        cb: (err: Error | null, accept: boolean) => void,
    ) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);
        const extOk = ALLOWED_EXTENSIONS.includes(ext);

        if (!mimeOk || !extOk) {
            return cb(
                new BadRequestException('Only JPEG, PNG, WEBP, or GIF images are allowed'),
                false,
            );
        }
        cb(null, true);
    },
};
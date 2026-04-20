import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Shared Multer options for all image upload endpoints.
 * Enforces MIME type allowlist and 5 MB size limit.
 * Apply via: @UseInterceptors(FileInterceptor('file', IMAGE_UPLOAD_OPTIONS))
 */
export const IMAGE_UPLOAD_OPTIONS = {
    storage: memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter: (
        _req: any,
        file: Express.Multer.File,
        cb: (err: Error | null, accept: boolean) => void,
    ) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            return cb(
                new BadRequestException('Only JPEG, PNG, WEBP, or GIF images are allowed'),
                false,
            );
        }
        cb(null, true);
    },
};
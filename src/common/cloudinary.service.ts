import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
    async uploadFile(file: any): Promise<UploadApiResponse | UploadApiErrorResponse> {
        return new Promise((resolve, reject) => {
            const upload = cloudinary.uploader.upload_stream(
                {
                    folder: 'tesla_shop',
                    resource_type: 'auto',
                },
                (error, result) => {
                    if (error) return reject(error);

                    // 🛡️ THE FIX: Handle the case where result is undefined
                    if (!result) {
                        return reject(new Error('Cloudinary upload failed: result is undefined'));
                    }

                    resolve(result);
                },
            );

            const stream = new Readable();
            stream.push(file.buffer);
            stream.push(null);
            stream.pipe(upload);
        });
    }
}
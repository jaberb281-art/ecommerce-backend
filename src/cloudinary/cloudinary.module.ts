import { Module } from '@nestjs/common';
import { CloudinaryProvider } from './cloudinary.provider';
import { CloudinaryService } from './cloudinary.service';

@Module({
    providers: [CloudinaryProvider, CloudinaryService],
    exports: [CloudinaryService], // Export so other modules (e.g. ProductsModule) can inject it
})
export class CloudinaryModule { }
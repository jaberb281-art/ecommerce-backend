import {
    Controller,
    Get,
    Patch,
    Post,
    Body,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ShopSettingsService } from './shop-settings.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CloudinaryService } from '../../cloudinary/cloudinary.service'; // Added based on your sidebar

@Controller('shop-settings')
export class ShopSettingsController {
    constructor(
        private readonly shopSettingsService: ShopSettingsService,
        private readonly cloudinaryService: CloudinaryService, // Inject your service
    ) { }

    @Get()
    async getSettings() {
        return this.shopSettingsService.getSettings();
    }

    @Patch('update')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    async updateSettings(@Body() updateData: any) {
        return this.shopSettingsService.updateSettings(updateData);
    }

    @Post('upload-hero')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @UseInterceptors(FileInterceptor('file'))
    async uploadHeroImage(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('No image file provided');
        }

        // This uses your existing Cloudinary logic
        const uploadResult = await this.cloudinaryService.uploadImage(file);

        // Update the database with the real URL from Cloudinary
        return this.shopSettingsService.updateHeroImage(uploadResult.secure_url);
    }
}
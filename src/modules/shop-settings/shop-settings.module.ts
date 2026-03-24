import { Module } from '@nestjs/common';
import { ShopSettingsService } from './shop-settings.service';
import { ShopSettingsController } from './shop-settings.controller';
import { PrismaModule } from '../../prisma/prisma.module'; // Adjust if your prisma folder is elsewhere
import { CloudinaryModule } from '../../cloudinary/cloudinary.module';

@Module({
  imports: [
    PrismaModule,
    CloudinaryModule
  ],
  providers: [ShopSettingsService],
  controllers: [ShopSettingsController],
  exports: [ShopSettingsService] // Exporting it in case you need it in other modules later
})
export class ShopSettingsModule { }
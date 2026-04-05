import { Module } from '@nestjs/common';
import { PointsService } from './points.service';
import { PointsController } from './points.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [PointsController],
    providers: [PointsService],
    exports: [PointsService], // ← OrdersModule imports this
})
export class PointsModule { }
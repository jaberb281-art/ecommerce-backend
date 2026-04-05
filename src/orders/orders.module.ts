import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CouponsModule } from '../coupons/coupons.module';
import { AddressesModule } from '../addresses/addresses.module';
import { PointsModule } from '../points/points.module'; // ← NEW

@Module({
    imports: [
        PrismaModule,
        CouponsModule,
        AddressesModule,
        PointsModule, // ← NEW: gives OrdersService access to PointsService
    ],
    controllers: [OrdersController],
    providers: [OrdersService],
})
export class OrdersModule { }
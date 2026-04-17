import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // This runs when the backend starts
  async onModuleInit() {
    await this.$connect();
  }

  // This runs when the backend shuts down
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
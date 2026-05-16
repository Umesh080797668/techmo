import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { InventoryModule } from './inventory/inventory.module';
import { StockMovementsModule } from './stock-movements/stock-movements.module';
import { TransfersModule } from './transfers/transfers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    // TransfersModule MUST be before InventoryModule so that
    // GET /api/v1/inventory/transfers is registered before
    // the wildcard GET /api/v1/inventory/:id route.
    TransfersModule,
    InventoryModule,
    StockMovementsModule,
  ],
})
export class AppModule {}

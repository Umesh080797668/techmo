import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { CompatibilityModule } from './compatibility/compatibility.module';
import { DeviceModelsModule } from './device-models/device-models.module';
import { PricingModule } from './pricing/pricing.module';
import { WarrantyModule } from './warranty/warranty.module';
import { ImeiModule } from './imei/imei.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ProductsModule,
    CompatibilityModule,
    DeviceModelsModule,
    PricingModule,
    WarrantyModule,
    ImeiModule,
  ],
})
export class AppModule {}

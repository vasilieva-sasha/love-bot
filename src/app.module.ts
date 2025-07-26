import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ormConfig } from './config/ormconfig';
import { BotModule } from './bot/bot.module';
import { UserModule } from './user/user.module';
import { CoupleModule } from './couple/couple.module';
import { InviteModule } from './invite/invite.module';
import { MenuModule } from './menu/menu.module';
import { OrderModule } from './order/order.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        synchronize: true,
        autoLoadEntities: true,
      }),
    }),

    BotModule,
    UserModule,
    CoupleModule,
    InviteModule,
    MenuModule,
    OrderModule,
  ],
})
export class AppModule {}

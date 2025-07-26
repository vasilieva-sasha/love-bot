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
    // Загружаем .env и делаем его доступным глобально
    ConfigModule.forRoot({ isGlobal: true }),

    // Подключаем TypeORM с использованием ormConfig
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = { ...ormConfig };
        // If using sqljs, database must be Uint8Array
        if (config.type === 'sqljs') {
          config.database = undefined; // or set to new Uint8Array() if needed
        } else {
          config.database =
            configService.get<string>('DATABASE_URL') || 'postgres';
        }
        return config;
      },
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

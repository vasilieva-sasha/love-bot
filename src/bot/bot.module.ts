import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { BotUpdate } from './bot.update';
import { BotService } from './bot.service';
import { ConfigService } from '@nestjs/config';
import { MenuModule } from 'src/menu/menu.module';
import { UserModule } from 'src/user/user.module';
import { OrderModule } from 'src/order/order.module';
import { InviteModule } from 'src/invite/invite.module';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        token: config.get<string>('BOT_TOKEN') || '',
      }),
    }),
    MenuModule,
    UserModule,
    OrderModule,
    InviteModule,
  ],
  providers: [BotUpdate, BotService],
})
export class BotModule {}

import {
  Update,
  Start,
  Ctx,
  Hears,
  On,
  Action,
  Command,
} from 'nestjs-telegraf';
import { Context, Context as TelegrafContext } from 'telegraf';
import { BotService } from './bot.service';
import { Currency } from 'src/order/order.entity';

// Extend Context to include startPayload
interface CustomContext extends TelegrafContext {
  startPayload?: string;
}

@Update()
export class BotUpdate {
  constructor(private readonly botService: BotService) {}

  @Start()
  async start(@Ctx() ctx: Context) {
    const { startPayload } = ctx as CustomContext;
    if (startPayload?.startsWith('invite_')) {
      const token = startPayload.replace('invite_', '');
      await this.botService.handleInvite(ctx, token);
      return;
    }

    await this.botService.handleStart(ctx);
  }

  @Command('reset')
  async reset(@Ctx() ctx: Context) {
    await this.botService.confirmReset(ctx);
  }

  @Command('balance')
  async balance(@Ctx() ctx: Context) {
    await this.botService.showBalance(ctx);
  }

  @Command('history')
  async history(@Ctx() ctx: Context) {
    await this.botService.showOrderHistory(ctx);
  }

  @Hears('Создать меню')
  async createMenu(@Ctx() ctx: Context) {
    await this.botService.startMenuCreation(ctx);
  }

  @Hears('Моё меню')
  async showMenu(@Ctx() ctx: Context) {
    await this.botService.showMenu(ctx);
  }

  @Hears('Меню партнёра')
  async showPartnerMenu(@Ctx() ctx: Context) {
    await this.botService.showPartnerMenu(ctx);
  }

  @Hears('Пригласить партнёра')
  async invitePartner(@Ctx() ctx: Context) {
    await this.botService.generateInviteLink(ctx);
  }

  @On('text')
  async handleText(@Ctx() ctx: Context) {
    await this.botService.handleMenuInput(ctx);
  }

  @Action(/^delete_(.+)$/)
  async handleDelete(@Ctx() ctx: Context) {
    if (
      ctx.callbackQuery &&
      'data' in ctx.callbackQuery &&
      typeof ctx.callbackQuery.data === 'string'
    ) {
      const match = /^delete_(.+)$/.exec(ctx.callbackQuery.data);
      const callbackData = match ? match[1] : null; // id элемента
      if (callbackData) {
        await this.botService.deleteMenuItem(ctx, callbackData);
      }
    }
  }

  @Action(/^edit_(.+)$/)
  async handleEdit(@Ctx() ctx: Context) {
    if (
      ctx.callbackQuery &&
      'data' in ctx.callbackQuery &&
      typeof ctx.callbackQuery.data === 'string'
    ) {
      const match = /^edit_(.+)$/.exec(ctx.callbackQuery.data);
      const itemId = match ? match[1] : null;
      if (itemId) {
        await this.botService.startEditMenuItem(ctx, itemId);
      }
    }
  }

  @Action(/^order_(.+)$/)
  async orderMenuItem(@Ctx() ctx: Context) {
    let itemId: string | null = null;
    if (
      ctx.callbackQuery &&
      'data' in ctx.callbackQuery &&
      typeof ctx.callbackQuery.data === 'string'
    ) {
      const match = /^order_(.+)$/.exec(ctx.callbackQuery.data);
      itemId = match ? match[1] : null;
    }
    if (itemId) {
      await this.botService.startOrder(ctx, itemId);
    }
  }

  @Action(/^currency_(.+)$/)
  async chooseCurrency(@Ctx() ctx: Context) {
    let currency: string | null = null;
    if (
      ctx.callbackQuery &&
      'data' in ctx.callbackQuery &&
      typeof ctx.callbackQuery.data === 'string'
    ) {
      const match = /^currency_(.+)$/.exec(ctx.callbackQuery.data);
      currency = match ? match[1] : null;
    }
    if (currency) {
      await this.botService.chooseCurrency(ctx, currency as Currency);
    }
  }

  @Action(/^accept_(.+)$/)
  async handleAccept(@Ctx() ctx: Context) {
    let orderId: string | null = null;
    if (
      ctx.callbackQuery &&
      'data' in ctx.callbackQuery &&
      typeof ctx.callbackQuery.data === 'string'
    ) {
      const match = /^accept_(.+)$/.exec(ctx.callbackQuery.data);
      orderId = match ? match[1] : null;
    }
    if (orderId) {
      // Вызываем метод для принятия заказа
      await this.botService.acceptOrder(ctx, orderId);
    }
  }

  @Action(/^reject_(.+)$/)
  async handleReject(@Ctx() ctx: Context) {
    let orderId: string | null = null;
    if (
      ctx.callbackQuery &&
      'data' in ctx.callbackQuery &&
      typeof ctx.callbackQuery.data === 'string'
    ) {
      const match = /^reject_(.+)$/.exec(ctx.callbackQuery.data);
      orderId = match ? match[1] : null;
    }
    if (orderId) {
      await this.botService.rejectOrder(ctx, orderId);
    }
  }

  @Action('confirm_reset')
  async confirmReset(@Ctx() ctx: Context) {
    await this.botService.handleResetConfirm(ctx);
  }

  @Action('cancel_reset')
  async cancelReset(@Ctx() ctx: Context) {
    await this.botService.handleResetCancel(ctx);
  }

  @Action(/^complete_(.+)$/)
  async handleComplete(@Ctx() ctx: Context) {
    let orderId: string | null = null;
    if (
      ctx.callbackQuery &&
      'data' in ctx.callbackQuery &&
      typeof ctx.callbackQuery.data === 'string'
    ) {
      const match = /^complete_(.+)$/.exec(ctx.callbackQuery.data);
      orderId = match ? match[1] : null;
    }
    if (orderId) {
      await this.botService.completeOrder(ctx, orderId);
    }
  }
}

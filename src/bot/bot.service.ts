import { Injectable } from '@nestjs/common';
import { Context } from 'telegraf';
import { MenuService } from '../menu/menu.service';
import { UserService } from '../user/user.service';
import {
  mainMenuKeyboard,
  doneKeyboard,
  buildMenuManagementKeyboard,
  buildPartnerMenuKeyboard,
  currencyKeyboard,
  confirmResetKeyboard,
} from './bot.keyboards';
import { OrderService } from 'src/order/order.service';
import { Currency, OrderStatus } from 'src/order/order.entity';
import { InviteService } from 'src/invite/invite.service';

@Injectable()
export class BotService {
  private userStates = new Map<number, string>(); // состояния для меню
  private editingMenuItem = new Map<number, string>(); // id пункта для редактирования
  private orderState = new Map<
    number,
    { menuItemId: string; currency?: Currency; message?: string }
  >(); // состояния заказов

  constructor(
    private menuService: MenuService,
    private userService: UserService,
    private orderService: OrderService,
    private inviteService: InviteService,
  ) {}

  // ========== ХЕЛПЕРЫ ==========
  private getUserId(ctx: Context): string | null {
    return ctx.from?.id ? ctx.from.id.toString() : null;
  }

  private async ensureUser(ctx: Context) {
    const userId = this.getUserId(ctx);
    if (!userId) return null;

    let user = await this.userService.findByTelegramId(userId);
    if (!user) {
      user = await this.userService.create({
        telegramId: userId,
        name: ctx.from?.first_name || 'Без имени',
      });
    }
    return user;
  }

  // ========== СТАРТ И МЕНЮ ==========
  async handleStart(ctx: Context) {
    const user = await this.ensureUser(ctx);
    if (!user) return;

    const text = `Привет! 👋

Этот бот помогает парам радовать друг друга милыми сюрпризами:

• Придумайте свой список заботы (массаж, ужин и т.д.)
• Заказывайте друг другу эти сюрпризы за «валюту любви» (поцелуи, обнимашки, послания)
• Копите баланс и смотрите историю заказов

Готовы начать?`;

    await ctx.reply(text, mainMenuKeyboard);
  }

  async startMenuCreation(ctx: Context) {
    const user = await this.ensureUser(ctx);
    if (!user) return;

    this.userStates.set(Number(user.telegramId), 'ADDING_MENU');
    await ctx.reply(
      'Напиши первый пункт (например, массаж, завтрак). Когда закончишь — нажми "Готово".',
      doneKeyboard,
    );
  }

  async showMenu(ctx: Context) {
    const user = await this.ensureUser(ctx);
    if (!user) return;

    const items = await this.menuService.findByOwner(user.telegramId);

    if (items.length === 0) {
      await ctx.reply(
        'Список пуст. Нажми "Добавить пункт в мой список", чтобы добавить пункты.',
      );
      return;
    }

    const list = items.map((i) => `• ${i.title}`).join('\n');
    await ctx.reply(
      `Твои сюрпризы:\n${list}\n\nНажми на пункт, чтобы отредактировать или удалить его:`,
      buildMenuManagementKeyboard(items),
    );
  }

  async startEditMenuItem(ctx: Context, itemId: string) {
    const user = await this.ensureUser(ctx);
    if (!user) return;

    const item = await this.menuService.findOne(itemId);
    if (!item) return;

    this.editingMenuItem.set(Number(user.telegramId), itemId);
    await ctx.reply(`Напиши новое название для "${item.title}":`);
  }

  async deleteMenuItem(ctx: Context, itemId: string) {
    const user = await this.ensureUser(ctx);
    if (!user) return;

    await this.menuService.remove(itemId);

    try {
      await ctx.deleteMessage(); // удаляем сообщение со старой клавиатурой
    } catch {}

    return this.showMenu(ctx); // показываем обновлённый список
  }

  // ========== РАБОТА С ПАРТНЁРОМ ==========
  async showPartnerMenu(ctx: Context) {
    const user = await this.ensureUser(ctx);
    if (!user) return;

    if (!user.coupleId) {
      await ctx.reply(
        'У тебя пока нет пары. Пригласи партнёра, чтобы смотреть его предложения.',
      );
      return;
    }

    const partner = await this.userService.findPartner(user.telegramId);
    if (!partner) {
      await ctx.reply('Партнёр не найден.');
      return;
    }

    const items = await this.menuService.findByOwner(partner.telegramId);
    if (items.length === 0) {
      await ctx.reply('Партнёр ещё не придумал сюрпризы.');
      return;
    }

    await ctx.reply('Сюрпризы для тебя:', buildPartnerMenuKeyboard(items));
  }

  async generateInviteLink(ctx: Context) {
    const user = await this.ensureUser(ctx);
    if (!user) return;

    if (user.coupleId) {
      await ctx.reply('У тебя уже есть пара — приглашение не требуется ❤️');
      return;
    }

    const invite = await this.inviteService.createInvite(user.id);
    const botUsername = (await ctx.telegram.getMe()).username;
    const link = `https://t.me/${botUsername}?start=invite_${invite.token}`;

    await ctx.reply(`Отправь эту ссылку партнёру:\n${link}`);
  }

  async handleInvite(ctx: Context, token: string) {
    const user = await this.ensureUser(ctx);
    if (!user) return;
    const invite = await this.inviteService.findByToken(token);

    if (invite?.creatorId === user.id) {
      await ctx.reply('Нельзя использовать собственную ссылку 😅');
      return;
    }

    const creatorId = await this.inviteService.useInvite(token);
    if (!creatorId) {
      await ctx.reply('Эта ссылка недействительна или уже использована.');
      return;
    }

    if (user.coupleId) {
      await ctx.reply('Ты уже состоишь в паре ❤️');
      const invite = await this.inviteService.findByToken(token);
      if (invite) {
        const creator = await this.userService.findById(invite.creatorId);
        if (creator?.telegramId) {
          await ctx.telegram.sendMessage(
            Number(creator.telegramId),
            'Человек, которому ты отправил ссылку, уже состоит в паре и не может её принять.',
          );
        }
      }
      return;
    }

    await this.userService.createCouple(creatorId, user.id);
    await this.handleStart(ctx);
  }

  // ========== ЗАКАЗЫ ==========
  async startOrder(ctx: Context, menuItemId: string) {
    const user = await this.ensureUser(ctx);
    if (!user) return;

    this.orderState.set(Number(user.telegramId), { menuItemId });
    await ctx.reply('Выбери валюту для этого заказа:', currencyKeyboard);
  }

  async chooseCurrency(ctx: Context, currency: Currency) {
    const user = await this.ensureUser(ctx);
    if (!user) return;

    const state = this.orderState.get(Number(user.telegramId));
    if (!state) return;

    state.currency = currency;
    this.orderState.set(Number(user.telegramId), state);

    await ctx.reply(
      `Укажи срок выполнения (например, "завтра", "до ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU')}"):`,
    );
  }

  async acceptOrder(ctx: Context, orderId: string) {
    const order = await this.orderService.findById(orderId);
    if (!order) {
      await ctx.reply('Заказ не найден или уже обработан.');
      return;
    }

    await this.orderService.updateStatus(orderId, OrderStatus.ACCEPTED);

    await ctx.editMessageText(
      'Заказ принят! Когда выполнишь — нажми "Выполнено".',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Выполнено 🎉', callback_data: `complete_${orderId}` }],
          ],
        },
      },
    );

    const sender = await this.userService.findById(order.fromUserId);
    if (sender?.telegramId) {
      await ctx.telegram.sendMessage(
        Number(sender.telegramId),
        `Твой заказ принят! Ждём выполнения 💕`,
      );
    }
  }

  async rejectOrder(ctx: Context, orderId: string) {
    const order = await this.orderService.findById(orderId);
    if (!order) {
      await ctx.reply('Заказ не найден или уже обработан.');
      return;
    }

    await this.orderService.updateStatus(orderId, OrderStatus.REJECTED);
    await ctx.editMessageText('Заказ отклонён ❌');

    const sender = await this.userService.findById(order.fromUserId);
    if (sender?.telegramId) {
      await ctx.telegram.sendMessage(
        Number(sender.telegramId),
        'Твой заказ отклонён 😔',
      );
    }
  }

  async completeOrder(ctx: Context, orderId: string) {
    const order = await this.orderService.findById(orderId);
    if (!order) {
      await ctx.reply('Заказ не найден.');
      return;
    }

    await this.orderService.updateStatus(orderId, OrderStatus.COMPLETED);
    await ctx.editMessageText('Заказ отмечен как выполненный 🎉');

    // Валюта — поцелуй или обнимашка
    if (order.currency !== 'message') {
      const executor = await this.userService.findById(order.toUserId);
      if (executor) {
        if (order.currency === 'kiss') {
          await this.userService.updateBalance(executor.id, {
            kissesBalance: executor.kissesBalance + 1,
          });
        } else if (order.currency === 'hug') {
          await this.userService.updateBalance(executor.id, {
            hugsBalance: executor.hugsBalance + 1,
          });
        }
      }

      const creator = await this.userService.findById(order.fromUserId);
      if (creator?.telegramId) {
        await ctx.telegram.sendMessage(
          Number(creator.telegramId),
          `Твой заказ выполнен! Валюта начислена 🎉`,
        );
      }
      return;
    }

    // Валюта — послание
    const creator = await this.userService.findById(order.fromUserId);
    if (creator?.telegramId) {
      await ctx.telegram.sendMessage(
        Number(creator.telegramId),
        `Заказ выполнен! Теперь напиши послание, которое получит твой партнёр 💌`,
      );

      this.orderState.set(Number(creator.telegramId), {
        menuItemId: order.menuItemId,
        currency: Currency.MESSAGE,
        message: `order:${orderId}`,
      });
    }
  }

  // ========== ХЭНДЛЕР ТЕКСТОВОГО ВВОДА ==========
  async handleMenuInput(ctx: Context) {
    const userId = this.getUserId(ctx);
    if (!userId) return;

    const text = (ctx.message as any)?.text;
    if (!text) return;

    // Приоритет: редактирование -> добавление -> заказы/послания
    if (this.editingMenuItem.has(Number(userId))) {
      return this.processEditMenuInput(userId, text, ctx);
    }

    if (this.userStates.get(Number(userId)) === 'ADDING_MENU') {
      return this.processAddMenuInput(userId, text, ctx);
    }

    const pending = this.orderState.get(Number(userId));
    if (
      pending?.currency === 'message' &&
      pending.message?.startsWith('order:')
    ) {
      return this.processOrderMessageInput(userId, text, ctx, pending.message);
    } else if (pending?.currency) {
      return this.processOrderDeadlineInput(userId, text, ctx, pending);
    }
  }

  // приватные обработчики для handleMenuInput
  private async processEditMenuInput(
    userId: string,
    text: string,
    ctx: Context,
  ) {
    const editingId = this.editingMenuItem.get(Number(userId));
    if (!editingId) return;

    await this.menuService.updateTitle(editingId, text);
    this.editingMenuItem.delete(Number(userId));
    await ctx.reply(`Название обновлено на "${text}"`);

    return this.showMenu(ctx);
  }

  private async processAddMenuInput(
    userId: string,
    text: string,
    ctx: Context,
  ) {
    if (text === 'Готово') {
      this.userStates.delete(Number(userId));
      const items = await this.menuService.findByOwner(userId);
      const list = items.map((i) => `• ${i.title}`).join('\n') || 'Список пуст';
      await ctx.reply(`Твой список:\n${list}`, mainMenuKeyboard);
      const partner = await this.userService.findPartner(userId);
      if (partner?.telegramId) {
        await ctx.telegram.sendMessage(
          Number(partner.telegramId),
          `Твой партнёр обновил свой список сюрпризов! 💕\n\n${list}`,
        );
      }
      return;
    }

    await this.menuService.create(userId, text);
    await ctx.reply(
      `Добавлено: "${text}". Напиши следующий пункт или нажми "Готово".`,
    );
  }

  private async processOrderMessageInput(
    userId: string,
    text: string,
    ctx: Context,
    messageState: string,
  ) {
    const orderId = messageState.split(':')[1];
    const order = await this.orderService.findById(orderId);

    if (order) {
      await this.orderService.update(orderId, { message: text });

      const executor = await this.userService.findById(order.toUserId);
      if (executor?.telegramId) {
        await ctx.telegram.sendMessage(
          Number(executor.telegramId),
          `Тебе послание от партнёра:\n\n"${text}" 💌`,
        );
      }
    }

    this.orderState.delete(Number(userId));
    await ctx.reply('Послание отправлено!');
  }

  private async processOrderDeadlineInput(
    userId: string,
    text: string,
    ctx: Context,
    pending: { menuItemId: string; currency?: Currency },
  ) {
    const user = await this.userService.findByTelegramId(userId);
    const partner = await this.userService.findPartner(userId);

    if (!partner) {
      await ctx.reply('Партнёр не найден.');
      this.orderState.delete(Number(userId));
      return;
    }

    const newOrder = await this.orderService.create({
      fromUserId: user?.id,
      toUserId: partner.id,
      menuItemId: pending.menuItemId,
      currency: pending.currency,
      deadline: text,
      status: OrderStatus.PENDING,
    });

    await ctx.reply(`Заказ отправлен партнёру!`);

    const menuItem = await this.menuService.findOne(pending.menuItemId);

    await ctx.telegram.sendMessage(
      Number(partner.telegramId),
      `Тебе заказали: ${menuItem?.title || ''} ${pending.currency}\nСрок: ${text}\nПринять?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Принять ✅', callback_data: `accept_${newOrder.id}` },
              { text: 'Отклонить ❌', callback_data: `reject_${newOrder.id}` },
            ],
          ],
        },
      },
    );

    this.orderState.delete(Number(userId));
  }

  // ========== ПРОЧЕЕ ==========
  async confirmReset(ctx: Context) {
    await ctx.reply(
      'Ты точно хочешь разорвать пару? Это действие нельзя отменить.',
      confirmResetKeyboard,
    );
  }

  async handleResetConfirm(ctx: Context) {
    const user = await this.ensureUser(ctx);
    if (!user) return;

    const partnerId = await this.userService.resetCouple(user.id);

    if (!partnerId) {
      await ctx.editMessageText('У тебя нет пары для сброса.');
      return;
    }

    await ctx.editMessageText(
      'Пара разорвана. Теперь ты можешь создать новую.',
    );

    const partner = await this.userService.findById(partnerId);
    if (partner?.telegramId) {
      await ctx.telegram.sendMessage(
        Number(partner.telegramId),
        'Твой партнёр разорвал пару. Теперь вы больше не связаны.',
      );
    }
  }

  async handleResetCancel(ctx: Context) {
    await ctx.editMessageText('Сброс пары отменён.');
  }

  async showBalance(ctx: Context) {
    const user = await this.ensureUser(ctx);
    if (!user) return;

    await ctx.reply(
      `Твой баланс:\n\nПоцелуев: ${user.kissesBalance}\nОбнимашек: ${user.hugsBalance}`,
    );
  }

  async showOrderHistory(ctx: Context) {
    const user = await this.ensureUser(ctx);
    if (!user) return;

    const orders = await this.orderService.findByUser(user.id);

    if (orders.length === 0) {
      await ctx.reply('У тебя пока нет заказов.');
      return;
    }

    const history: string[] = [];
    for (const order of orders) {
      const role =
        order.fromUserId === user.id ? 'Ты заказал' : 'Тебе заказали';
      const status =
        order.status === OrderStatus.COMPLETED
          ? '✅ выполнен'
          : order.status === OrderStatus.ACCEPTED
            ? '⏳ в процессе'
            : order.status === OrderStatus.PENDING
              ? '⌛ ожидает'
              : '❌ отклонён';
      const menuItem = await this.menuService.findOne(order.menuItemId);
      history.push(
        `${role}: ${menuItem?.title || 'неизвестно'} ${order.currency} — ${order.deadline} (${status})`,
      );
    }

    await ctx.reply(`История заказов:\n\n${history.join('\n\n')}`);
  }
}

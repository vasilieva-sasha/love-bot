import { Injectable } from '@nestjs/common';
import { Context } from 'telegraf';
import { MenuService } from '../menu/menu.service';
import { UserService } from '../user/user.service';
import {
  mainMenuKeyboard,
  doneKeyboard,
  buildDeleteMenuKeyboard,
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
  private userStates = new Map<number, string>();
  private editingMenuItem = new Map<number, string>(); // userId → menuItemId
  private orderState = new Map<
    number,
    { menuItemId: string; currency?: Currency; message?: string }
  >();

  constructor(
    private menuService: MenuService,
    private userService: UserService,
    private orderService: OrderService,
    private inviteService: InviteService,
  ) {}

  // Проверка безопасного получения userId
  private getUserId(ctx: Context): string | null {
    const userId = ctx.from?.id;
    return userId ? userId.toString() : null;
  }

  async handleStart(ctx: Context) {
    const text = `Привет! 👋

Этот бот помогает парам радовать друг друга небольшими сюрпризами:

• Создайте своё меню заботы — например, массаж, ужин или совместная прогулка  
• Отправляйте заказы партнёру с милой валютой: поцелуи, обнимашки или послание  
• Отмечайте выполнение и копите баланс ваших «обнимашек» и «поцелуев»  

Готовы создать своё первое меню?`;

    // Проверяем, можем ли мы отправить сообщение
    if (ctx.reply) {
      await ctx.reply(text, mainMenuKeyboard);
    }
  }

  async startMenuCreation(ctx: Context) {
    const userId = this.getUserId(ctx);
    if (!userId) return; // если нет userId — выходим

    this.userStates.set(Number(userId), 'ADDING_MENU');

    if (ctx.reply) {
      await ctx.reply(
        'Напиши первый пункт меню (например, массаж, завтрак). Когда закончишь — нажми "Готово".',
        doneKeyboard,
      );
    }
  }

  async handleMenuInput(ctx: Context) {
    const userId = this.getUserId(ctx);
    if (!userId) return;

    const text = (ctx.message as any)?.text;
    if (!text) return;

    // --- Если редактируем пункт ---
    const editingId = this.editingMenuItem.get(Number(userId));
    if (editingId) {
      await this.menuService.updateTitle(editingId, text);
      this.editingMenuItem.delete(Number(userId));
      await ctx.reply(`Название обновлено на "${text}"`);

      return this.showMenu(ctx);
    }

    // --- Если в режиме добавления ---
    const state = this.userStates.get(Number(userId));
    if (state === 'ADDING_MENU') {
      if (text === 'Готово') {
        this.userStates.delete(Number(userId));
        const items = await this.menuService.findByOwner(userId);
        const list =
          items.map((i) => `• ${i.title}`).join('\n') || 'Меню пустое';
        await ctx.reply(`Твоё меню:\n${list}`, mainMenuKeyboard);
        return;
      }

      await this.menuService.create(userId, text);
      await ctx.reply(
        `Добавлено: "${text}". Напиши следующий пункт или нажми "Готово".`,
      );
      return;
    }

    // --- Состояние заказа или послания ---
    const pending = this.orderState.get(Number(userId));

    // 1. Если ждём послание после выполнения заказа
    if (
      pending &&
      pending.currency === 'message' &&
      pending.message?.startsWith('order:')
    ) {
      const orderId = pending.message.split(':')[1];
      const order = await this.orderService.findById(orderId);

      if (order) {
        // Сохраняем послание
        await this.orderService.update(orderId, { message: text });

        // Отправляем послание партнёру (исполнителю)
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
      return;
    }

    // 2. Если ждём срок для нового заказа
    if (pending && pending.currency) {
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

      // Уведомляем партнёра
      await ctx.telegram.sendMessage(
        Number(partner.telegramId),
        `Тебе заказали: ${menuItem?.title || ''} ${pending.currency}\nСрок: ${text}\nПринять?`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Принять ✅', callback_data: `accept_${newOrder.id}` },
                {
                  text: 'Отклонить ❌',
                  callback_data: `reject_${newOrder.id}`,
                },
              ],
            ],
          },
        },
      );

      this.orderState.delete(Number(userId));
      return;
    }
  }

  async showMenu(ctx: Context) {
    const userId = this.getUserId(ctx);
    if (!userId) return;

    const items = await this.menuService.findByOwner(userId);

    if (items.length === 0) {
      if (ctx.reply) {
        await ctx.reply(
          'Меню пустое. Нажми "Создать меню", чтобы добавить пункты.',
        );
      }
      return;
    }

    const list = items.map((i) => `• ${i.title}`).join('\n');
    if (ctx.reply) {
      await ctx.reply(
        `Твоё меню:\n${list}\n\nНажми на пункт, чтобы отредактировать или удалить его:`,
        buildMenuManagementKeyboard(items),
      );
    }
  }

  async deleteMenuItem(ctx: Context, itemId: string) {
    const userId = this.getUserId(ctx);
    if (!userId) return;

    await this.menuService.remove(itemId);

    // Обновляем список
    const items = await this.menuService.findByOwner(userId);
    const list = items.map((i) => `• ${i.title}`).join('\n') || 'Меню пустое';

    if (ctx.editMessageText) {
      await ctx.editMessageText(
        `Твоё меню:\n${list}\n\nНажми на кнопку, чтобы удалить пункт:`,
        items.length > 0
          ? buildDeleteMenuKeyboard(items)
          : { reply_markup: { inline_keyboard: [] } }, // empty inline keyboard if no items
      );
    }
  }

  async startEditMenuItem(ctx: Context, itemId: string) {
    const userId = this.getUserId(ctx);
    if (!userId) return;

    const item = await this.menuService.findOne(itemId);
    if (!item) return;

    this.editingMenuItem.set(Number(userId), itemId);

    if (ctx.reply) {
      await ctx.reply(`Напиши новое название для "${item.title}":`);
    }
  }

  async showPartnerMenu(ctx: Context) {
    const userId = this.getUserId(ctx);
    if (!userId) return;

    const user = await this.userService.findByTelegramId(userId);
    if (!user?.coupleId) {
      await ctx.reply(
        'У тебя пока нет пары. Пригласи партнёра, чтобы смотреть его меню.',
      );
      return;
    }

    // Находим партнёра
    const partner = await this.userService.findPartner(userId);
    if (!partner) {
      await ctx.reply('Партнёр не найден.');
      return;
    }
    const items = await this.menuService.findByOwner(partner.telegramId);

    if (items.length === 0) {
      await ctx.reply('У партнёра пока пустое меню.');
      return;
    }

    await ctx.reply('Меню партнёра:', buildPartnerMenuKeyboard(items));
  }

  async startOrder(ctx: Context, menuItemId: string) {
    const userId = this.getUserId(ctx);
    if (!userId) return;

    this.orderState.set(Number(userId), { menuItemId });
    await ctx.reply('Выбери валюту для этого заказа:', currencyKeyboard);
  }

  async chooseCurrency(ctx: Context, currency: Currency) {
    const userId = this.getUserId(ctx);
    if (!userId) return;

    const state = this.orderState.get(Number(userId));
    if (!state) return;

    state.currency = currency;
    this.orderState.set(Number(userId), state);

    await ctx.reply(
      `Укажи срок выполнения (например, "завтра", "до ${new Date(Date.now() + 24 * 60 * 60 * 1000).toDateString()}"):`,
    );
  }

  async generateInviteLink(ctx: Context) {
    const userId = this.getUserId(ctx);
    if (!userId) return;

    // Ищем пользователя
    let user = await this.userService.findByTelegramId(userId);
    if (!user) {
      user = await this.userService.create({
        telegramId: userId,
        name: ctx.from?.first_name || 'Без имени',
      });
    }

    // Проверка: если уже есть пара — не даём создавать инвайт
    if (user.coupleId) {
      await ctx.reply('У тебя уже есть пара — приглашение не требуется ❤️');
      return;
    }

    // Создаём инвайт
    const invite = await this.inviteService.createInvite(user.id);

    const botUsername = (await ctx.telegram.getMe()).username;
    const link = `https://t.me/${botUsername}?start=invite_${invite.token}`;

    await ctx.reply(`Отправь эту ссылку партнёру:\n${link}`);
  }

  async handleInvite(ctx: Context, token: string) {
    const userId = this.getUserId(ctx);
    if (!userId) return;

    // Находим или создаём пользователя
    let user = await this.userService.findByTelegramId(userId);
    if (!user) {
      user = await this.userService.create({
        telegramId: userId,
        name: ctx.from?.first_name || 'Без имени',
      });
    }

    if (user.coupleId) {
      await ctx.reply('Ты уже состоишь в паре ❤️');
      const invite = await this.inviteService.findByToken(token); // метод нужно добавить
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

    // Проверяем токен
    const creatorId = await this.inviteService.useInvite(token);
    if (!creatorId) {
      await ctx.reply('Эта ссылка недействительна или уже использована.');
      return;
    }

    if (creatorId === user.id) {
      await ctx.reply('Нельзя использовать собственную ссылку 😅');
      return;
    }

    // Создаём пару
    await this.userService.createCouple(creatorId, user.id);

    await this.handleStart(ctx);
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

    // Уведомляем отправителя
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

    // Уведомляем отправителя
    const sender = await this.userService.findById(order.fromUserId);
    if (sender?.telegramId) {
      await ctx.telegram.sendMessage(
        Number(sender.telegramId),
        'Твой заказ отклонён 😔',
      );
    }
  }

  async confirmReset(ctx: Context) {
    await ctx.reply(
      'Ты точно хочешь разорвать пару? Это действие нельзя отменить.',
      confirmResetKeyboard,
    );
  }

  async handleResetConfirm(ctx: Context) {
    const userId = this.getUserId(ctx);
    if (!userId) return;

    const user = await this.userService.findByTelegramId(userId);
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся в боте.');
      return;
    }

    const partnerId = await this.userService.resetCouple(user.id);

    if (!partnerId) {
      await ctx.editMessageText('У тебя нет пары для сброса.');
      return;
    }

    await ctx.editMessageText(
      'Пара разорвана. Теперь ты можешь создать новую.',
    );

    // Уведомляем партнёра
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

  async completeOrder(ctx: Context, orderId: string) {
    const order = await this.orderService.findById(orderId);
    if (!order) {
      await ctx.reply('Заказ не найден.');
      return;
    }

    // Обновляем статус
    await this.orderService.updateStatus(orderId, OrderStatus.COMPLETED);
    await ctx.editMessageText('Заказ отмечен как выполненный 🎉');

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

    // Если валюта — послание
    const creator = await this.userService.findById(order.fromUserId);
    if (creator?.telegramId) {
      await ctx.telegram.sendMessage(
        Number(creator.telegramId),
        `Заказ выполнен! Теперь напиши послание, которое получит твой партнёр 💌`,
      );

      // Сохраняем состояние: ждём послание
      this.orderState.set(Number(creator.telegramId), {
        menuItemId: order.menuItemId,
        currency: Currency.MESSAGE,
        message: `order:${orderId}`,
      });
    }
  }

  async showBalance(ctx: Context) {
    const userId = this.getUserId(ctx);
    if (!userId) return;

    const user = await this.userService.findByTelegramId(userId);
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся.');
      return;
    }

    await ctx.reply(
      `Твой баланс:\n\nПоцелуев: ${user.kissesBalance}\nОбнимашек: ${user.hugsBalance}`,
    );
  }

  async showOrderHistory(ctx: Context) {
    const userId = this.getUserId(ctx);
    if (!userId) return;

    const user = await this.userService.findByTelegramId(userId);
    if (!user) {
      await ctx.reply('Сначала зарегистрируйся.');
      return;
    }

    // Находим все заказы, где пользователь — заказчик или исполнитель
    const orders = await this.orderService.findByUser(user.id);

    if (orders.length === 0) {
      await ctx.reply('У тебя пока нет заказов.');
      return;
    }

    const history = orders
      .map(async (o) => {
        const role = o.fromUserId === user.id ? 'Ты заказал' : 'Тебе заказали';
        const status =
          o.status === 'completed'
            ? '✅ выполнен'
            : o.status === 'accepted'
              ? '⏳ в процессе'
              : o.status === 'pending'
                ? '⌛ ожидает'
                : '❌ отклонён';
        const menuItem = await this.menuService.findOne(o.menuItemId);
        return `${role}: ${menuItem?.title || 'неизвестно'} ${o.currency} — ${o.deadline} (${status})`;
      })
      .join('\n\n');

    await ctx.reply(`История заказов:\n\n${history}`);
  }
}

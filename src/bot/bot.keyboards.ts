import { InlineKeyboardButton } from 'telegraf/typings/core/types/typegram';

export const mainMenuKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: '🌸 Придумать сюрприз для партнера' }],
      [
        { text: '💌 Что могу сделать для тебя' },
        { text: '🎁 Что ты можешь для меня' },
      ],
      [{ text: '🔗 Пригласить партнёра' }],
      [{ text: '📊 Баланс' }, { text: '🕓 История заказов' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

export const doneKeyboard = {
  reply_markup: {
    keyboard: [[{ text: 'Готово' }]],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

export function buildDeleteMenuKeyboard(
  items: { id: string; title: string }[],
) {
  return {
    reply_markup: {
      inline_keyboard: items.map((item) => [
        {
          text: `Удалить: ${item.title}`,
          callback_data: `delete_${item.id}`,
        } as InlineKeyboardButton,
      ]),
    },
  };
}

export function buildMenuManagementKeyboard(
  items: { id: string; title: string }[],
) {
  return {
    reply_markup: {
      inline_keyboard: items.map((item) => [
        { text: `✏ ${item.title}`, callback_data: `edit_${item.id}` },
        { text: `🗑 Удалить`, callback_data: `delete_${item.id}` },
      ]),
    },
  };
}

export function buildPartnerMenuKeyboard(
  items: { id: string; title: string }[],
) {
  return {
    reply_markup: {
      inline_keyboard: items.map((item) => [
        { text: `Заказать: ${item.title}`, callback_data: `order_${item.id}` },
      ]),
    },
  };
}

export const currencyKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: 'Поцелуй 💋', callback_data: 'currency_kiss' },
        { text: 'Обнимашка 🤗', callback_data: 'currency_hug' },
      ],
      [{ text: 'Послание 💌', callback_data: 'currency_message' }],
    ],
  },
};

export const confirmResetKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: 'Да, разорвать', callback_data: 'confirm_reset' },
        { text: 'Нет, отмена', callback_data: 'cancel_reset' },
      ],
    ],
  },
};

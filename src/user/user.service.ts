import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Couple } from 'src/couple/couple.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Couple) private coupleRepo: Repository<Couple>,
  ) {}

  create(data: Partial<User>) {
    return this.userRepo.save(this.userRepo.create(data));
  }

  findByTelegramId(telegramId: string) {
    return this.userRepo.findOne({ where: { telegramId } });
  }

  async findPartner(userId: string): Promise<User | null> {
    // Находим пользователя
    const user = await this.userRepo.findOne({ where: { telegramId: userId } });
    if (!user?.coupleId) return null;

    // Находим пару
    const couple = await this.coupleRepo.findOne({
      where: { id: user.coupleId },
    });
    if (!couple) return null;

    // Определяем id партнёра
    const partnerId =
      couple.user1Id === user.id ? couple.user2Id : couple.user1Id;

    if (!partnerId) return null;

    return this.userRepo.findOne({ where: { id: partnerId } });
  }

  async createCouple(userId: string, partnerId: string) {
    // создаём пару
    const couple = this.coupleRepo.create({
      user1Id: userId,
      user2Id: partnerId,
    });
    await this.coupleRepo.save(couple);

    // обновляем пользователей
    await this.userRepo.update(userId, { coupleId: couple.id });
    await this.userRepo.update(partnerId, { coupleId: couple.id });

    return couple;
  }

  async findById(id: string) {
    return this.userRepo.findOne({ where: { id } });
  }

  async resetCouple(userId: string) {
    // Находим пользователя
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.coupleId) return false;

    // Находим пару
    const couple = await this.coupleRepo.findOne({
      where: { id: user.coupleId },
    });
    if (!couple) return false;

    // Определяем партнёра
    const partnerId =
      couple.user1Id === user.id ? couple.user2Id : couple.user1Id;

    // Сбрасываем coupleId у обоих пользователей
    await this.userRepo.update(user.id, { coupleId: null });
    if (partnerId) {
      await this.userRepo.update(partnerId, { coupleId: null });
    }

    // Удаляем пару
    await this.coupleRepo.delete(couple.id);

    return partnerId; // вернём id партнёра для уведомления
  }

  async updateBalance(userId: string, balances: Partial<User>) {
    await this.userRepo.update(userId, balances);
  }
}

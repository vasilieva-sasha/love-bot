import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './order.entity';

@Injectable()
export class OrderService {
  constructor(@InjectRepository(Order) private repo: Repository<Order>) {}

  create(data: Partial<Order>) {
    return this.repo.save(this.repo.create(data));
  }

  async findByUser(userId: string) {
    return this.repo.find({
      where: [{ fromUserId: userId }, { toUserId: userId }],
      order: { createdAt: 'DESC' },
      take: 10,
    });
  }

  async updateStatus(orderId: string, status: OrderStatus) {
    await this.repo.update(orderId, { status });
    return this.repo.findOne({ where: { id: orderId } });
  }

  async findById(orderId: string) {
    return this.repo.findOne({ where: { id: orderId } });
  }

  async update(orderId: string, data: Partial<Order>): Promise<Order | null> {
    await this.repo.update(orderId, data);
    return this.repo.findOne({ where: { id: orderId } });
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Couple } from './couple.entity';

@Injectable()
export class CoupleService {
  constructor(@InjectRepository(Couple) private repo: Repository<Couple>) {}

  create(user1Id: string, user2Id: string) {
    const couple = this.repo.create({ user1Id, user2Id });
    return this.repo.save(couple);
  }

  findByUser(userId: string) {
    return this.repo.findOne({
      where: [{ user1Id: userId }, { user2Id: userId }],
    });
  }
}

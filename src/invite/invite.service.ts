import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invite } from './invite.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class InviteService {
  constructor(@InjectRepository(Invite) private repo: Repository<Invite>) {}

  async createInvite(creatorId: string) {
    const token = randomUUID();

    const invite = this.repo.create({
      token,
      creatorId,
      isUsed: false,
    });

    return this.repo.save(invite);
  }

  async useInvite(token: string) {
    const invite = await this.repo.findOne({ where: { token, isUsed: false } });
    if (!invite) return null;

    invite.isUsed = true;
    await this.repo.save(invite);

    return invite.creatorId;
  }

  async findByToken(token: string) {
    return this.repo.findOne({ where: { token } });
  }
}

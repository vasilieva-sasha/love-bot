import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuItem } from './menu.entity';

@Injectable()
export class MenuService {
  constructor(@InjectRepository(MenuItem) private repo: Repository<MenuItem>) {}

  create(ownerId: string, title: string) {
    return this.repo.save(this.repo.create({ ownerId, title }));
  }

  findByOwner(ownerId: string) {
    return this.repo.find({ where: { ownerId } });
  }

  remove(id: string) {
    return this.repo.delete(id);
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async updateTitle(id: string, newTitle: string) {
    await this.repo.update(id, { title: newTitle });
    return this.repo.findOne({ where: { id } });
  }
}

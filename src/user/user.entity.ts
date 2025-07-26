import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  telegramId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  coupleId: string | null;

  @Column({ type: 'integer', default: 0 })
  kissesBalance: number;

  @Column({ type: 'integer', default: 0 })
  hugsBalance: number;
}

import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  token: string;

  @Column()
  creatorId: string;

  @Column({ default: false })
  isUsed: boolean;
}

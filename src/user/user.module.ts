import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserService } from './user.service';
import { Couple } from 'src/couple/couple.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Couple])],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}

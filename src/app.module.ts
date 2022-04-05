import { Module } from '@nestjs/common'
import { AppService } from './app.service'
import { HttpModule } from '@nestjs/axios'
import { ConfigModule } from '@nestjs/config'
import configuration from './configuration'
import { ScheduleModule } from '@nestjs/schedule'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    HttpModule,
  ],
  providers: [AppService],
})
export class AppModule {}

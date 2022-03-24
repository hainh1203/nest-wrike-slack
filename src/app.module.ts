import { Module } from '@nestjs/common'
import { AppService } from './app.service'
import { HttpModule } from '@nestjs/axios'
import { ConfigModule } from '@nestjs/config'
import configuration from './configuration'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    HttpModule,
  ],
  providers: [AppService],
})
export class AppModule {}

import { AppModule } from './app.module'
import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions } from '@nestjs/microservices'

async function bootstrap() {
  const port: number = +process.env.PORT

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      options: {
        port: port,
      },
    },
  )

  await app.listen()

  console.log(`app is running in port ${port}`)
}
bootstrap()

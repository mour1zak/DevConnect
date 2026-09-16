import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';;
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';


async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService)
  console.log(
    'JWT_SECRET recebida:',
    configService.get('JWT_SECRET'),
  )

 

  // CORS liberado para o frontend Angular (devconnect-frontend, ng serve na 4200 / docker na 4300).
  // Em dev liberamos qualquer origem; se for para produção, trocar por uma lista fixa de domínios.
  app.enableCors({
    origin: true,
    credentials: true,
  })
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/'
  })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  const config = new DocumentBuilder()
  .setTitle('DevConnect API')
  .setDescription('Rede social de estudo - usuários, posts, comentários e reacões.')
  .setVersion('1.0')
  .addBearerAuth()
  .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header'}, 'api-key')
  .addSecurityRequirements('api-key')
  .addSecurityRequirements('bearer')
  .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  })


  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

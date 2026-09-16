import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { catchError, firstValueFrom } from 'rxjs';
import { CreateNotification } from './interfaces/create-notification.interface';

@Injectable()
export class NotificationClientService {
    private readonly logger = new Logger(NotificationClientService.name)

    constructor(private readonly httpService: HttpService) {}

    async create(notification: CreateNotification): Promise<void> {
       try { 
        await firstValueFrom(
            this.httpService.post('/notifications', notification),
            )
             }  catch(error) {
                const axiosError = error as AxiosError
                    this.logger.error(
                        `Falha ao Notificar userId=${notification.userId}. Status: ${axiosError.response?.status ?? 'sem resposta'}`,
                    )

            }
     }
}

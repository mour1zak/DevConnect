import { Injectable, Logger } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name)

    create(dto: CreateNotificationDto) {
        const notification = {
            id: Date.now(),
            ...dto,
            createdAt: new Date().toISOString(),        
        }
        this.logger.log(`Notificacao criada para userId=${dto.userId}, type=${dto.type}`)

        return notification
    }
}

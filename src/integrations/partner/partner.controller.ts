import { Controller, Get } from '@nestjs/common';
import { PartnerService } from './partner.service';


@Controller('partner')
export class PartnerController {
    constructor(private readonly partnerService: PartnerService) {}

    @Get('check-auth')
    checkAuthentication() {
        return this.partnerService.checkAuthentication()
    }
}

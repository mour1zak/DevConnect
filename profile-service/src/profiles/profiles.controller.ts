import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ProfilesService } from './profiles.service';

@Controller('profiles')
export class ProfilesController {
    constructor(private readonly profilesService: ProfilesService) {}

    @Get(':userId')
    findOne(@Param('userId', ParseIntPipe) userId: number) {
        return this.profilesService.findOne(userId)
    }
}

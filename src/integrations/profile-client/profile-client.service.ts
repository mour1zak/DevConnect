import { HttpService } from '@nestjs/axios';
import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { Profile } from './interfaces/profile.interface';
import axios from 'axios';

@Injectable()
export class ProfileClientService {
    private readonly logger = new Logger(ProfileClientService.name)

    constructor(private readonly httpService: HttpService) {}

    async findByUserId(userId: number): Promise<Profile | null> {
        try{ 
        const { data } = await firstValueFrom(
            this.httpService.get<Profile>(`/profiles/${userId}`),
        )
        return data 
     }catch (error) {
        const axiosError = error as AxiosError
        const status = axiosError.response?.status
             
        if (status == 404) {
            this.logger.warn(`Perfil do usuario ${userId} não encontrado - devolvendo null`)
            return null
        }

        this.logger.error(`Falha ao consultar Profile Service para userId=${userId}. Status: ${status ?? 'sem resposta'}`)
            throw new BadGatewayException('Profile Service indisponivel')
             }
         }

     }
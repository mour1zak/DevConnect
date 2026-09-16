import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { catchError, first, firstValueFrom } from 'rxjs';
@Injectable()
export class PartnerService {
    private readonly logger = new Logger(PartnerService.name)
    constructor(private readonly httpService: HttpService) {}

    async checkAuthentication(): Promise<{ authenticated: boolean }> {
        const { data } = await firstValueFrom(
            this.httpService.get('/bearer').pipe(
                catchError((error: AxiosError) => {
                    const status = error.response?.status
                    
                    this.logger.error(
                        `Falha ao autenticar com o parceiro. Status externo: ${status ?? 'sem resposta'}`,
                    )

                    throw new BadGatewayException('Não foi possivel comunicar com o parceiro')
                })
            )
        )
        return { authenticated: data.authenticated }
    }
}

import { HttpService } from '@nestjs/axios';
import { BadGatewayException, Logger, NotFoundException, Injectable } from '@nestjs/common';
import { AxiosError } from 'axios';
import { catchError, firstValueFrom } from 'rxjs';
import { ExternalUser } from './interfaces/external-user.interface';
import { CreateExternalPostDto } from './dto/create-external-post.dto';
import { ExternalPost } from './interfaces/external-post.interface';
import { ExternalUserSummary } from './interfaces/external-user-summary.interface';

@Injectable()
export class ExternalUsersService {
    private readonly logger = new Logger(ExternalUsersService.name)
  constructor(private readonly httpService: HttpService) {}

  async findAll(): Promise<ExternalUserSummary[]> {
    const { data } = await firstValueFrom(
      this.httpService.get<ExternalUser[]>('/users').pipe(
        catchError((error: AxiosError) => {
            this.logger.error(
                `Erro ao listar usuários externos. Status externo: ${error.response?.status ?? 'sem resposta'}`,
            )
            throw new BadGatewayException('Não foi possivel consultar o serviço externo')
        })
      )
    );

    return data.map((user) => this.toSummary(user));
  }

  async findOne(id: number): Promise<ExternalUserSummary> {
    const { data } = await firstValueFrom(
      this.httpService.get<ExternalUser>(`/users/${id}`).pipe(
        catchError((error: AxiosError) => {
            const status = error.response?.status

            this.logger.error(
                `Erro ao consultar usuário externo ${id}. Status externo: ${status ?? 'sem resposta'} `,
            )

            if (status === 404) {
                throw new NotFoundException(`Usuário externo ${id} não encontrado`)
            }

            throw new BadGatewayException('Não foi possivel consultar o serviço externo')
        })
      )
    );

    return this.toSummary(data);
  }

  async createPost(dto: CreateExternalPostDto): Promise<ExternalPost> {
    const { data } = await firstValueFrom(
      this.httpService.post<ExternalPost>('/posts', dto).pipe(
        catchError((error: AxiosError) => {
            this.logger.error(
                `Erro ao criar post no serviço externo. Status externo: ${error.response?.status ?? 'sem resposta'}`,
            )
            throw new BadGatewayException('Não foi possivel enviar dados ao serviço externo')
        })
      )
    );

    return data;
  }

  async findPostsByUser(userId: number): Promise<ExternalPost[]> {
    const { data } = await firstValueFrom(
        this.httpService.get<ExternalPost[]>('/posts', {
            params: { userId },
        }).pipe(
            catchError((error: AxiosError) => {
                this.logger.error(
                    `Erro ao listar posts do usuário externo ${userId}. Status externo: ${error.response?.status ?? 'sem resposta'}`,
                )

                throw new BadGatewayException('Não foi possivel consultar o servico externo')
            })
        )
    )
    return data
  }

  private toSummary(user: ExternalUser): ExternalUserSummary {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
    }
  }
}
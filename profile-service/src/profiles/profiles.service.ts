import { Injectable, NotFoundException } from '@nestjs/common';
import { Profile } from './interfaces/profile.interface';


@Injectable()
export class ProfilesService {
    private readonly profiles: Profile[] = [
        {
            userId: 1,
            displayName: 'Gabriel',
            bio: 'Analystics IA',
            location: 'São Paulo',
            avatarUrl: 'https://example.com/avatar-1.png',
        },
        {
            userId: 2,
            displayName: 'Maria',
            bio: 'Product Designer',
            location: 'Rio de Janeiro',
            avatarUrl: 'https://example.com/avatar-2.png'
        },
    ]
    
    findOne(userId: number): Profile {
        const profile = this.profiles.find((item) => item.userId === userId)

        if (!profile) {
            throw new NotFoundException(`Perfil do usuário ${userId} não encontrado`)
        }

        return profile
    }
}

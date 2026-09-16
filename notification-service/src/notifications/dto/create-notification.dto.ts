import  { IsIn, IsInt, IsNotEmpty, IsString, Min } from 'class-validator'

export class CreateNotificationDto {
    @IsInt()
    @Min(1)
    userId!: number

    @IsString()
    @IsIn(['NEW_COMMENT', 'POST_LIKED'])
    type!: string

    @IsString()
    @IsNotEmpty()
    message!: string
}
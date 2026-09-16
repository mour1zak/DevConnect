import { IsInt, IsNotEmpty, isNotEmpty, IsString, Min } from "class-validator";

export class CreateExternalPostDto {
    @IsString()
    @IsNotEmpty()
    title!: string

    @IsString()
    @IsNotEmpty()
    body!: string

    @IsInt()
    @Min(1)
    userId!: number
}
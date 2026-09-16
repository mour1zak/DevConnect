import { Injectable, PipeTransform, ArgumentMetadata, BadRequestException } from "@nestjs/common";

@Injectable()
export class NotBlankPipe implements PipeTransform {
    transform(value: any, metadata: ArgumentMetadata) {
        if ( value === undefined || value === null) {
            return value
        }

        const trimmed = String(value).trim()

        if (trimmed.length === 0) {
            throw new BadRequestException(`${metadata.data} não pode ser um texto em branco`)
        }

        return trimmed
    }
}
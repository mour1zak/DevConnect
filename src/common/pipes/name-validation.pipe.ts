import { Injectable, PipeTransform, ArgumentMetadata, BadRequestException } from "@nestjs/common";

@Injectable()
export class NameValidationPipe implements PipeTransform {
    transform(value: any, metadata: ArgumentMetadata) {
        if (/\d/.test(value)) {
            throw new BadRequestException(`${metadata.data} não pode conter números`)
        }
        return value
    }
}
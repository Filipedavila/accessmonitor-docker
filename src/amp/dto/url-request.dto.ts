import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class UrlRequestDto {
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;

    // 🛡️ REGEX ESTRICTA: Valida se a string de entrada tem a estrutura real de um Base64
    const base64Regex =
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

    if (!base64Regex.test(value)) {
      // Retornamos um valor inválido propositadamente para o IsUrl ou IsString falharem à frente
      // Evitamos lançar erros explícitos aqui dentro para não quebrar o ciclo do NestJS
      return 'INVALID_BASE64_STRING';
    }

    // Faz o decode seguro sabendo que a estrutura é válida
    return Buffer.from(value, 'base64').toString('utf-8');
  })
  @IsString({ message: 'The URL param must be a valid string.' })
  @IsNotEmpty({ message: 'The URL param should not be empty.' })
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
    },
    { message: 'The decoded base64 content must be a valid HTTP/HTTPS URL.' },
  )
  url!: string;
}

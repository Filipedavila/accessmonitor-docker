import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class UrlRequestDto {
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;

    try {
      return decodeURIComponent(value);
    } catch {
      return 'INVALID_URL_ENCODED_STRING';
    }
  })
  @IsString({ message: 'The URL param must be a valid string.' })
  @IsNotEmpty({ message: 'The URL param should not be empty.' })
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
    },
    { message: 'The decode content must be a valid HTTP/HTTPS URL.' },
  )
  url!: string;
}

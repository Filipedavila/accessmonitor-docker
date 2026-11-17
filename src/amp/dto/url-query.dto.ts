import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

/** Query `?url=...` do endpoint SSE (o Express já faz o decode da query string). */
export class UrlQueryDto {
  @IsString({ message: 'The url query must be a valid string.' })
  @IsNotEmpty({ message: 'The url query should not be empty.' })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true, require_valid_protocol: true },
    { message: 'The url must be a valid HTTP/HTTPS URL.' },
  )
  url!: string;
}

import { IsNotEmpty, IsString, Length } from 'class-validator';

export class EvaluateHtmlDto {
  @IsString({ message: 'The HTML field must be a valid string.' })
  @IsNotEmpty({ message: 'The HTML field should not be empty.' })
  @Length(1, 10000000, {
    message: 'The HTML provided exceeds the maximum allowed limit of 10MB.',
  })
  html!: string;
}

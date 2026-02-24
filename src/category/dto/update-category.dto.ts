import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto'; // Ensure this name matches your file

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) { }
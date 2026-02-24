import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Patch,
  Delete,
  UploadedFile,
  UseInterceptors,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../cloudinary/cloudinary.service'; // ✅ Fixed path
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  // -----------------------------------------------------------------------
  // GET /products?page=1&limit=10&categoryId=x&search=y — Public
  // -----------------------------------------------------------------------
  @Get()
  @ApiOperation({ summary: 'Get all products with pagination, filtering and search' })
  async findAll(@Query() paginationDto: PaginationDto) {
    return this.productsService.findAll(paginationDto);
  }

  // -----------------------------------------------------------------------
  // POST /products/upload-image — Admin only
  // IMPORTANT: Must be defined BEFORE /:id routes to avoid NestJS matching
  // "upload-image" as a product ID parameter
  // -----------------------------------------------------------------------
  @Post('upload-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload a product image to Cloudinary (Admin only)' })
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException({
        code: 'NO_FILE',
        message: 'No file uploaded',
      });
    }

    const result = await this.cloudinaryService.uploadImage(file);
    return { url: (result as any).secure_url };
  }

  // -----------------------------------------------------------------------
  // POST /products — Admin only
  // -----------------------------------------------------------------------
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new product (Admin only)' })
  async create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  // -----------------------------------------------------------------------
  // GET /products/:id — Public
  // -----------------------------------------------------------------------
  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by ID' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  // -----------------------------------------------------------------------
  // PATCH /products/:id — Admin only
  // -----------------------------------------------------------------------
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  // -----------------------------------------------------------------------
  // DELETE /products/:id — Admin only
  // -----------------------------------------------------------------------
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a product (Admin only)' })
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}

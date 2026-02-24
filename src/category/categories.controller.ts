import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) { }

    // -----------------------------------------------------------------------
    // POST /categories — Admin only
    // -----------------------------------------------------------------------
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new category (Admin only)' })
    async create(@Body() dto: CreateCategoryDto) {
        return this.categoriesService.create(dto);
    }

    // -----------------------------------------------------------------------
    // GET /categories — Public
    // Returns all categories with product count
    // -----------------------------------------------------------------------
    @Get()
    @ApiOperation({ summary: 'Get all categories with product count' })
    async findAll() {
        return this.categoriesService.findAll();
    }

    // -----------------------------------------------------------------------
    // GET /categories/:id — Public
    // Returns a single category with its full product list
    // -----------------------------------------------------------------------
    @Get(':id')
    @ApiOperation({ summary: 'Get a single category with its products' })
    async findOne(@Param('id') id: string) {
        return this.categoriesService.findOne(id);
    }

    // -----------------------------------------------------------------------
    // PATCH /categories/:id — Admin only
    // -----------------------------------------------------------------------
    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a category (Admin only)' })
    async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
        return this.categoriesService.update(id, dto);
    }

    // -----------------------------------------------------------------------
    // DELETE /categories/:id — Admin only
    // -----------------------------------------------------------------------
    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a category (Admin only)' })
    async remove(@Param('id') id: string) {
        return this.categoriesService.remove(id);
    }
}
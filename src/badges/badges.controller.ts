import {
    Controller, Get, Post, Patch, Delete, Body, Param, Request,
    UseGuards, UseInterceptors, UploadedFile, BadRequestException
} from '@nestjs/common';
import { BadgesService } from './badges.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { IMAGE_UPLOAD_OPTIONS } from '../common/upload.options';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { UpdateBadgeDto } from './dto/update-badge.dto';

@ApiTags('badges')
@Controller('badges')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class BadgesController {
    constructor(
        private badgesService: BadgesService,
        private cloudinaryService: CloudinaryService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Get all badges' })
    findAll() {
        return this.badgesService.findAll()
    }

    @Get('users')
    @ApiOperation({ summary: 'Get all users with their badges' })
    getAllUsersWithBadges() {
        return this.badgesService.getAllUsersWithBadges()
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a single badge' })
    findOne(@Param('id') id: string) {
        return this.badgesService.findOne(id)
    }

    @Post('upload-image')
    @UseInterceptors(FileInterceptor('file', IMAGE_UPLOAD_OPTIONS))
    @ApiOperation({ summary: 'Upload badge image' })
    async uploadImage(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('No file uploaded')
        const result = await this.cloudinaryService.uploadImage(file)
        return { url: (result as any).secure_url }
    }

    @Post()
    @ApiOperation({ summary: 'Create a badge' })
    create(@Body() dto: CreateBadgeDto) {
        return this.badgesService.create(dto)
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a badge' })
    update(@Param('id') id: string, @Body() dto: UpdateBadgeDto) {
        return this.badgesService.update(id, dto)
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a badge' })
    remove(@Param('id') id: string) {
        return this.badgesService.remove(id)
    }

    @Post(':id/award/:userId')
    @ApiOperation({ summary: 'Award badge to user' })
    award(
        @Request() req: any,
        @Param('id') badgeId: string,
        @Param('userId') userId: string,
        @Body() body: { note?: string },
    ) {
        // awardedBy is always the authenticated admin — never trusted from the client body
        return this.badgesService.awardToUser(badgeId, userId, req.user.id, body.note)
    }

    @Delete(':id/revoke/:userId')
    @ApiOperation({ summary: 'Revoke badge from user' })
    revoke(@Param('id') badgeId: string, @Param('userId') userId: string) {
        return this.badgesService.revokeFromUser(badgeId, userId)
    }

    @Get('user/:userId')
    @ApiOperation({ summary: 'Get badges for a user' })
    getUserBadges(@Param('userId') userId: string) {
        return this.badgesService.getUserBadges(userId)
    }
}
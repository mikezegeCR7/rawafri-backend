import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ComplaintsService } from './complaints.service';
import { UpdateComplaintDto } from './dto/update-complaint.dto';
import { ComplaintResponseDto } from './dto/complaint-response.dto';

@ApiTags('Admin Complaints')
@ApiBearerAuth()
@Controller('complaints/admin')
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminComplaintsController {
  constructor(
    private readonly complaintsService: ComplaintsService,
  ) {}

  @ApiOperation({ summary: 'Get all complaints' })
  @ApiResponse({
    status: 200,
    type: [ComplaintResponseDto],
  })
  @Get()
  findAll() {
    return this.complaintsService.findAll();
  }

  @ApiOperation({ summary: 'Get one complaint' })
  @ApiResponse({
    status: 200,
    type: ComplaintResponseDto,
  })
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.complaintsService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a complaint' })
  @ApiResponse({
    status: 200,
    type: ComplaintResponseDto,
  })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateComplaintDto,
  ) {
    return this.complaintsService.update(
      id,
      dto,
    );
  }
}
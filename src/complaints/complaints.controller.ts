import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ComplaintsService } from './complaints.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ComplaintResponseDto } from './dto/complaint-response.dto';

@ApiTags('Complaints')
@ApiBearerAuth()
@Controller('complaints')
export class ComplaintsController {
  constructor(
    private readonly complaintsService: ComplaintsService,
  ) {}

  @ApiOperation({ summary: 'Create a complaint' })
  @ApiResponse({
    status: 201,
    type: ComplaintResponseDto,
  })
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateComplaintDto,
  ) {
    return this.complaintsService.create(
      user.sub,
      dto,
    );
  }

  @ApiOperation({ summary: 'Get my complaints' })
  @ApiResponse({
    status: 200,
    type: [ComplaintResponseDto],
  })
  @Get()
  findMine(
    @CurrentUser() user: JwtPayload,
  ) {
    return this.complaintsService.findMine(
      user.sub,
    );
  }

  @ApiOperation({ summary: 'Get one of my complaints' })
  @ApiResponse({
    status: 200,
    type: ComplaintResponseDto,
  })
  @Get('my/:id')
  findMineById(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.complaintsService.findMineById(
      id,
      user.sub,
    );
  }
}
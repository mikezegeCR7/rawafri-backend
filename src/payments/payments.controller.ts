import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  imageFileFilter,
  paymentStorage,
} from '../common/upload/multer.config';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // GET /api/v1/payments
  @Get()
  findMyPayments(@CurrentUser() user: JwtPayload) {
    return this.paymentsService.findMyPayments(user.sub);
  }

  // GET /api/v1/payments/:id
  @Get(':id')
  findMyPayment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.findMyPayment(id, user.sub);
  }

  // PATCH /api/v1/payments/:id/upload-proof
  @Patch(':id/upload-proof')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: paymentStorage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadProof(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.paymentsService.uploadProof(id, user.sub, file);
  }
}
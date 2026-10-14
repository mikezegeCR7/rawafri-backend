import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiOkResponse, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { WishlistItemResponseDto, WishlistMessageResponseDto } from './dto';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

@ApiTags('wishlist')
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOkResponse({ type: WishlistItemResponseDto, isArray: true })
  findAll(@Req() req: Request): Promise<WishlistItemResponseDto[]> {
    const user = req.user as JwtPayload;
    return this.wishlistService.findAll(user.sub);
  }

  @Post(':productId')
  @ApiCreatedResponse({ type: WishlistItemResponseDto })
  add(
    @Req() req: Request,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<WishlistItemResponseDto> {
    const user = req.user as JwtPayload;
    return this.wishlistService.add(user.sub, productId);
  }

  @Delete(':productId')
  @ApiOkResponse({ type: WishlistMessageResponseDto })
  remove(
    @Req() req: Request,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<WishlistMessageResponseDto> {
    const user = req.user as JwtPayload;
    return this.wishlistService.remove(user.sub, productId);
  }
}
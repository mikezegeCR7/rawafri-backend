import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { imageFileFilter, imageUploadStorage } from '../common/upload/multer.config';
import { ProductsService } from './products.service';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductViewResponseDto,
  LogViewResponseDto,
  RecommendedProductDto,
} from './dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // POST /api/v1/products — Admin only
  @Post()
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  // POST /api/v1/products/upload-image — Admin only
  // Returns { imageUrl } for use in the CreateProductDto/UpdateProductDto
  // imageUrl field — this endpoint just uploads and hands back a URL, it
  // doesn't touch a product record itself.
  @Post('upload-image')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: imageUploadStorage,
      fileFilter: imageFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.productsService.uploadImage(file);
  }

  // GET /api/v1/products — Public
  @Get()
  @Public()
  findAll() {
    return this.productsService.findAll();
  }

  // GET /api/v1/products/recently-viewed — Authenticated
  // Must stay above GET /:id and /category/:categoryId or Nest will try to
  // match "recently-viewed" as a route param instead of this literal path.
  @Get('recently-viewed')
  @ApiOkResponse({ type: ProductViewResponseDto, isArray: true })
  getRecentlyViewed(@Req() req: Request): Promise<ProductViewResponseDto[]> {
    const user = req.user as JwtPayload;
    return this.productsService.getRecentlyViewed(user.sub);
  }

  // GET /api/v1/products/recommended — Authenticated
  // Same route-ordering reasoning as recently-viewed above.
  @Get('recommended')
  @ApiOkResponse({ type: RecommendedProductDto, isArray: true })
  getRecommended(@Req() req: Request): Promise<RecommendedProductDto[]> {
    const user = req.user as JwtPayload;
    return this.productsService.getRecommended(user.sub);
  }

  // GET /api/v1/products/category/:categoryId — Public
  @Get('category/:categoryId')
  @Public()
  findByCategory(@Param('categoryId', ParseUUIDPipe) categoryId: string) {
    return this.productsService.findByCategory(categoryId);
  }

  // GET /api/v1/products/:id — Public
  @Get(':id')
  @Public()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  // POST /api/v1/products/:id/view — Authenticated
  // Logs (or bumps the timestamp on) a product view for "Recently Viewed".
  @Post(':id/view')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LogViewResponseDto })
  logView(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LogViewResponseDto> {
    const user = req.user as JwtPayload;
    return this.productsService.logView(user.sub, id);
  }

  // PATCH /api/v1/products/:id — Admin only
  @Patch(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  // DELETE /api/v1/products/:id — Admin only
  @Delete(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }
}

@Controller('admin/products')
@Roles(Role.ADMIN)
@UseGuards(RolesGuard)
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // GET /api/v1/admin/products — Admin: every product, including
  // unpublished/inactive ones (the public GET /products only returns
  // active products, so admins need this to manage/republish hidden items).
  @Get()
  findAll() {
    return this.productsService.findAllAdmin();
  }
}
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  Headers, UnauthorizedException, ParseIntPipe, DefaultValuePipe,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, ModerateReviewDto } from './dto';

@ApiTags('Reviews')
@Controller('api/v1/reviews')
export class ReviewsController {
  constructor(private readonly svc: ReviewsService) {}

  // ── Public endpoints ───────────────────────────────────────────────────────

  /** Approved reviews — paginated, usable by the marketing site */
  @Get()
  @ApiOperation({ summary: 'List approved reviews (public)' })
  publicList(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)  page: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query('rating') rating?: string,
  ) {
    return this.svc.publicList(page, Math.min(limit, 50), rating ? +rating : undefined);
  }

  /** Featured reviews WITH photos — for the happy-customers gallery */
  @Get('gallery')
  @ApiOperation({ summary: 'Featured gallery (public)' })
  gallery() {
    return this.svc.gallery();
  }

  /** Aggregate stats — used by marketing site hero and admin widget */
  @Get('stats')
  @ApiOperation({ summary: 'Review statistics (public)' })
  stats() {
    return this.svc.stats();
  }

  // ── Customer endpoints (require X-Customer-Id header set by gateway) ───────

  /** Submit a new review */
  @Post()
  @ApiOperation({ summary: 'Submit a review (customer JWT)' })
  @ApiBearerAuth()
  create(
    @Headers('x-customer-id') customerId: string,
    @Body() dto: CreateReviewDto,
  ) {
    if (!customerId) throw new UnauthorizedException('Not authenticated');
    return this.svc.create(customerId, dto);
  }

  /** List own reviews */
  @Get('mine')
  @ApiOperation({ summary: 'My reviews (customer JWT)' })
  @ApiBearerAuth()
  myReviews(@Headers('x-customer-id') customerId: string) {
    if (!customerId) throw new UnauthorizedException('Not authenticated');
    return this.svc.myReviews(customerId);
  }

  /** Delete own review (only PENDING) */
  @Delete('mine/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete own review (customer JWT)' })
  @ApiBearerAuth()
  deleteOwn(
    @Headers('x-customer-id') customerId: string,
    @Param('id') id: string,
  ) {
    if (!customerId) throw new UnauthorizedException('Not authenticated');
    return this.svc.deleteOwn(customerId, id);
  }

  // ── Admin endpoints (require X-User-Id header set by gateway) ─────────────

  /** All reviews with optional status filter — admin moderation queue */
  @Get('admin')
  @ApiOperation({ summary: 'Admin: list all reviews' })
  @ApiBearerAuth()
  adminList(
    @Headers('x-user-id') userId: string,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe)  page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    if (!userId) throw new UnauthorizedException('Staff authentication required');
    return this.svc.adminList(status, page, limit);
  }

  /** Approve / reject a review and optionally mark as featured */
  @Patch(':id/moderate')
  @ApiOperation({ summary: 'Admin: moderate a review' })
  @ApiBearerAuth()
  moderate(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
    @Body() dto: ModerateReviewDto,
  ) {
    if (!userId) throw new UnauthorizedException('Staff authentication required');
    return this.svc.moderate(id, dto);
  }

  /** Toggle featured flag on an approved review */
  @Patch(':id/feature')
  @ApiOperation({ summary: 'Admin: toggle featured flag' })
  @ApiBearerAuth()
  toggleFeatured(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
  ) {
    if (!userId) throw new UnauthorizedException('Staff authentication required');
    return this.svc.toggleFeatured(id);
  }

  /** Hard-delete a review */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: delete a review' })
  @ApiBearerAuth()
  adminDelete(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
  ) {
    if (!userId) throw new UnauthorizedException('Staff authentication required');
    return this.svc.adminDelete(id);
  }
}

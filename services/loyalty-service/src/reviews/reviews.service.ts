import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto, ModerateReviewDto } from './dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Customer: submit a review ──────────────────────────────────────────────
  async create(customerId: string, dto: CreateReviewDto) {
    // One pending-or-approved review per customer per reference (or general).
    // Allows re-submitting only if the previous was REJECTED.
    const key = dto.referenceId ?? 'GENERAL';
    const existing = await this.prisma.review.findFirst({
      where: {
        customerId,
        referenceId: dto.referenceId ?? null,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });
    if (existing) {
      throw new BadRequestException(
        'You already have a pending or approved review for this item.',
      );
    }

    return this.prisma.review.create({
      data: {
        customerId,
        rating: dto.rating,
        title: dto.title,
        body: dto.body,
        photoUrl: dto.photoUrl,
        type: dto.type ?? 'GENERAL',
        referenceId: dto.referenceId,
      },
      select: this.customerSelect(),
    });
  }

  // ── Customer: list own reviews ─────────────────────────────────────────────
  async myReviews(customerId: string) {
    return this.prisma.review.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: this.customerSelect(),
    });
  }

  // ── Customer: delete own review (only if PENDING) ──────────────────────────
  async deleteOwn(customerId: string, id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.customerId !== customerId) throw new ForbiddenException('Not your review');
    if (review.status !== 'PENDING') {
      throw new BadRequestException('Only pending reviews can be deleted');
    }
    await this.prisma.review.delete({ where: { id } });
    return { message: 'Review deleted' };
  }

  // ── Public: approved reviews (paginated) ──────────────────────────────────
  async publicList(page = 1, limit = 12, rating?: number) {
    const where: any = { status: 'APPROVED' };
    if (rating) where.rating = rating;

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: this.publicSelect(),
      }),
      this.prisma.review.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  // ── Public: featured gallery (approved + featured=true + has photo) ────────
  async gallery() {
    return this.prisma.review.findMany({
      where: { status: 'APPROVED', featured: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        photoUrl: true,
        createdAt: true,
        customer: {
          select: { firstName: true, lastName: true },
        },
      },
    });
  }

  // ── Admin: list pending / all reviews ─────────────────────────────────────
  async adminList(status?: string, page = 1, limit = 20) {
    const where: any = {};
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: this.adminSelect(),
      }),
      this.prisma.review.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  // ── Admin: approve / reject / feature ─────────────────────────────────────
  async moderate(id: string, dto: ModerateReviewDto) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');

    return this.prisma.review.update({
      where: { id },
      data: {
        status: dto.status,
        featured: dto.featured ?? (dto.status === 'APPROVED' ? review.featured : false),
        adminNote: dto.adminNote,
      },
      select: this.adminSelect(),
    });
  }

  // ── Admin: toggle featured flag alone ─────────────────────────────────────
  async toggleFeatured(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.status !== 'APPROVED') {
      throw new BadRequestException('Only approved reviews can be featured');
    }
    return this.prisma.review.update({
      where: { id },
      data: { featured: !review.featured },
      select: this.adminSelect(),
    });
  }

  // ── Admin: delete ──────────────────────────────────────────────────────────
  async adminDelete(id: string) {
    await this.prisma.review.findUniqueOrThrow({ where: { id } });
    await this.prisma.review.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  // ── Stats for admin dashboard widget ──────────────────────────────────────
  async stats() {
    const [pending, approved, rejected, avgRating] = await Promise.all([
      this.prisma.review.count({ where: { status: 'PENDING' } }),
      this.prisma.review.count({ where: { status: 'APPROVED' } }),
      this.prisma.review.count({ where: { status: 'REJECTED' } }),
      this.prisma.review
        .aggregate({ where: { status: 'APPROVED' }, _avg: { rating: true } })
        .then(r => r._avg.rating ?? 0),
    ]);
    return { pending, approved, rejected, avgRating: Math.round(avgRating * 10) / 10 };
  }

  // ── Selectors ─────────────────────────────────────────────────────────────
  private publicSelect() {
    return {
      id: true, rating: true, title: true, body: true, photoUrl: true,
      featured: true, type: true, createdAt: true,
      customer: { select: { firstName: true, lastName: true } },
    };
  }

  private customerSelect() {
    return {
      id: true, rating: true, title: true, body: true, photoUrl: true,
      status: true, featured: true, type: true, referenceId: true,
      adminNote: true, createdAt: true, updatedAt: true,
    };
  }

  private adminSelect() {
    return {
      id: true, rating: true, title: true, body: true, photoUrl: true,
      status: true, featured: true, type: true, referenceId: true,
      adminNote: true, createdAt: true, updatedAt: true,
      customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
    };
  }
}

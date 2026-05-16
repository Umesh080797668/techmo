import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type VoteType = 'up' | 'down';

@Injectable()
export class CompatibilityVotesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cast or toggle a vote on a compatibility mapping.
   * If the staff member already voted the same way → removes the vote (toggle).
   * If they voted the other way → switches the vote.
   */
  async vote(
    compatibilityId: string,
    staffId: string,
    vote: VoteType,
    notes?: string,
  ) {
    const existing = await (this.prisma as any).compatibilityVote.findUnique({
      where: {
        compatibilityId_staffId: { compatibilityId, staffId },
      },
    });

    if (existing) {
      if (existing.vote === vote) {
        // Toggle off — remove vote
        await (this.prisma as any).compatibilityVote.delete({
          where: { id: existing.id },
        });
      } else {
        // Switch vote direction
        await (this.prisma as any).compatibilityVote.update({
          where: { id: existing.id },
          data: { vote, notes, updatedAt: new Date() },
        });
      }
    } else {
      await (this.prisma as any).compatibilityVote.create({
        data: { compatibilityId, staffId, vote, notes },
      });
    }

    return this.getTally(compatibilityId);
  }

  async getTally(compatibilityId: string) {
    const votes = await (this.prisma as any).compatibilityVote.findMany({
      where: { compatibilityId },
    });
    const upVotes   = votes.filter((v: any) => v.vote === 'up').length;
    const downVotes = votes.filter((v: any) => v.vote === 'down').length;
    const score     = upVotes - downVotes;
    const confidence: 'high' | 'medium' | 'low' | 'disputed' =
      score >= 5   ? 'high'    :
      score >= 2   ? 'medium'  :
      score >= 0   ? 'low'     : 'disputed';

    return { compatibilityId, upVotes, downVotes, score, confidence, total: votes.length };
  }

  async getTalliesForProduct(productId: string) {
    const compatibilities = await (this.prisma as any).partCompatibility.findMany({
      where: { productId },
      select: { id: true, deviceModelId: true, deviceModel: { select: { brand: true, model: true } } },
    });

    return Promise.all(
      compatibilities.map(async (c: any) => ({
        ...c,
        tally: await this.getTally(c.id),
      })),
    );
  }

  async getTopContributors(limit = 10) {
    const result = await (this.prisma as any).compatibilityVote.groupBy({
      by: ['staffId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });
    return result.map((r: any) => ({ staffId: r.staffId, voteCount: r._count.id }));
  }

  async getMyVote(compatibilityId: string, staffId: string) {
    return (this.prisma as any).compatibilityVote.findUnique({
      where: { compatibilityId_staffId: { compatibilityId, staffId } },
    });
  }
}

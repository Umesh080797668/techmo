import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CompatibilityVotesService, VoteType } from './compatibility-votes.service';

class VoteDto {
  vote!: VoteType;   // 'up' | 'down'
  staffId!: string;
  notes?: string;
}

@Controller('compatibility')
export class CompatibilityVotesController {
  constructor(private readonly votesService: CompatibilityVotesService) {}

  /**
   * POST /compatibility/:id/vote
   * Body: { vote: 'up'|'down', staffId: string, notes?: string }
   *
   * Technicians upvote a mapping to confirm a part fits the device,
   * or downvote when they discover an incorrect compatibility record.
   * Voting the same direction again removes the vote (toggle).
   */
  @Post(':id/vote')
  vote(
    @Param('id') compatibilityId: string,
    @Body() dto: VoteDto,
  ) {
    return this.votesService.vote(compatibilityId, dto.staffId, dto.vote, dto.notes);
  }

  /**
   * GET /compatibility/:id/tally
   * Returns { upVotes, downVotes, score, confidence }
   */
  @Get(':id/tally')
  tally(@Param('id') compatibilityId: string) {
    return this.votesService.getTally(compatibilityId);
  }

  /**
   * GET /compatibility/product/:productId/tallies
   * Returns all compatibility mappings for a product, each with their vote tally.
   */
  @Get('product/:productId/tallies')
  talliesForProduct(@Param('productId') productId: string) {
    return this.votesService.getTalliesForProduct(productId);
  }

  /**
   * GET /compatibility/:id/my-vote?staffId=
   */
  @Get(':id/my-vote')
  myVote(
    @Param('id') compatibilityId: string,
    @Query('staffId') staffId: string,
  ) {
    return this.votesService.getMyVote(compatibilityId, staffId);
  }

  /**
   * GET /compatibility/contributors/top
   * Leaderboard of most active voters.
   */
  @Get('contributors/top')
  topContributors(@Query('limit') limit?: string) {
    return this.votesService.getTopContributors(limit ? Number(limit) : 10);
  }
}

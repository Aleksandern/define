import {
  PipelineStage,
} from 'mongoose';

export class ChainsRpcsAggregate {
  chain() {
    const res: PipelineStage[] = [
      {
        $lookup: {
          from: 'chains',
          as: 'chain',
          localField: 'chainId',
          foreignField: '_id',
        },
      },
      {
        $addFields: {
          chain: {
            $arrayElemAt: ['$chain', 0],
          },
        },
      },
    ];

    return res;
  }

  relations() {
    const res: PipelineStage[] = [
      ...this.chain(),
    ];

    return res;
  }

  relationsPipeline(...data: Parameters<typeof this.relations>) {
    return this.relations(...data) as unknown as NonNullable<PipelineStage.Lookup['$lookup']['pipeline']>;
  }
}

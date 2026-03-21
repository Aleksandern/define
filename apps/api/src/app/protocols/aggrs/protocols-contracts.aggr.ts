import {
  PipelineStage,
} from 'mongoose';

export class ProtocolsContractsAggregate {
  protocol() {
    const res: PipelineStage[] = [
      {
        $lookup: {
          from: 'protocols',
          as: 'protocol',
          localField: 'protocolId',
          foreignField: '_id',
        },
      },
      {
        $addFields: {
          protocol: {
            $arrayElemAt: ['$protocol', 0],
          },
        },
      },
    ];

    return res;
  }

  relations() {
    const res: PipelineStage[] = [
      ...this.protocol(),
    ];

    return res;
  }

  relationsPipeline(...data: Parameters<typeof this.relations>) {
    return this.relations(...data) as unknown as NonNullable<PipelineStage.Lookup['$lookup']['pipeline']>;
  }
}

import {
  PipelineStage,
} from 'mongoose';

export class ProtocolsContractsAggregate {
  relations() {
    const res: PipelineStage[] = [
    ];

    return res;
  }

  relationsPipeline(...data: Parameters<typeof this.relations>) {
    return this.relations(...data) as unknown as NonNullable<PipelineStage.Lookup['$lookup']['pipeline']>;
  }
}

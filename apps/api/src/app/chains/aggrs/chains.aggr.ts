import {
  PipelineStage,
} from 'mongoose';

export class ChainsAggregate {
  static relations() {
    const res: PipelineStage[] = [
    ];

    return res;
  }

  static relationsPipeline(...data: Parameters<typeof this.relations>) {
    return ChainsAggregate.relations(...data) as unknown as NonNullable<PipelineStage.Lookup['$lookup']['pipeline']>;
  }
}

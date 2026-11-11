import { ReportModel, IReport, ReportType } from '../models/Report';

export class ReportRepository {
  static async create(data: Partial<IReport>): Promise<IReport> {
    const report = new ReportModel(data);
    return await report.save();
  }

  static async findByTypeAndHash(type: ReportType, paramsHash: string): Promise<IReport | null> {
    return ReportModel.findOne({ type, paramsHash }).exec();
  }
}


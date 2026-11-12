import { ReportModel, IReport, ReportType } from '../models/Report';

export class ReportRepository {
  static async create(data: Partial<IReport>): Promise<IReport> {
    const report = new ReportModel(data);
    return await report.save();
  }

  static async findByTypeAndHash(type: ReportType, paramsHash: string): Promise<IReport | null> {
    return ReportModel.findOne({ type, paramsHash }).exec();
  }

  static async findById(id: string): Promise<IReport | null> {
    return ReportModel.findById(id).exec();
  }

  static async list(limit = 20): Promise<IReport[]> {
    return ReportModel.find().sort({ createdAt: -1 }).limit(limit).exec();
  }
}


import mongoose from 'mongoose';
import { ComplaintRepository } from '../repositories/ComplaintRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { IComplaint, ComplaintStatus, ComplaintPriority } from '../models/Complaint';
import { AppError, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import { CreateComplaintInput, UpdateComplaintStatusInput } from '../validators/complaintValidators';
import { NotificationService } from './notificationService';
import { ComplaintModel } from '../models/Complaint';

export class ComplaintService {
  /**
   * Student creates a new complaint.
   */
  static async createComplaint(
    studentId: string,
    input: CreateComplaintInput,
    correlationId: string
  ): Promise<IComplaint> {
    const studentObjId = new mongoose.Types.ObjectId(studentId);
    const messObjId = new mongoose.Types.ObjectId(input.messId);

    const complaint = await ComplaintRepository.create({
      studentId: studentObjId,
      messId: messObjId,
      category: input.category,
      priority: input.priority || ComplaintPriority.MEDIUM,
      status: ComplaintStatus.OPEN,
      title: input.title.trim(),
      description: input.description.trim(),
      imageUrl: input.imageUrl || undefined,
      feedbackId: input.feedbackId ? new mongoose.Types.ObjectId(input.feedbackId) : undefined,
      history: [
        {
          status: ComplaintStatus.OPEN,
          changedBy: studentObjId,
          note: 'Complaint filed by student',
          timestamp: new Date(),
        },
      ],
    });

    // Notify student confirmation
    NotificationService.sendNotification({
      userId: studentObjId,
      title: 'Complaint Submitted',
      message: `Your complaint "${complaint.title}" has been registered (Ref: ${complaint._id.toString().slice(-6)}).`,
      eventKey: `complaint-created-${complaint._id}`,
    }).catch((err) => logger.warn('Failed to send complaint creation notification', correlationId, { err: err.message }));

    logger.info('Complaint created', correlationId, { complaintId: complaint._id.toString() });
    return complaint;
  }

  /**
   * Student lists their own complaints.
   */
  static async listStudentComplaints(studentId: string, page = 1, limit = 20) {
    return ComplaintRepository.list({
      studentId: new mongoose.Types.ObjectId(studentId),
      page,
      limit,
    });
  }

  /**
   * Manager lists complaints for their mess.
   */
  static async listMessComplaints(
    messId: string,
    filters: {
      status?: ComplaintStatus;
      priority?: ComplaintPriority;
      page?: number;
      limit?: number;
    }
  ) {
    return ComplaintRepository.list({
      messId: new mongoose.Types.ObjectId(messId),
      status: filters.status,
      priority: filters.priority,
      page: filters.page,
      limit: filters.limit,
    });
  }

  /**
   * Get single complaint ensuring ownership or mess scope.
   */
  static async getComplaintById(
    complaintId: string,
    scope: { studentId?: string; messId?: string }
  ): Promise<IComplaint> {
    const complaint = await ComplaintRepository.findById(complaintId, {
      studentId: scope.studentId ? new mongoose.Types.ObjectId(scope.studentId) : undefined,
      messId: scope.messId ? new mongoose.Types.ObjectId(scope.messId) : undefined,
    });

    if (!complaint) {
      throw AppError.notFound('Complaint not found.', ErrorCode.NOT_FOUND);
    }

    return complaint;
  }

  /**
   * Manager updates complaint status with note / manager response.
   */
  static async updateStatus(
    complaintId: string,
    messId: string,
    managerId: string,
    input: UpdateComplaintStatusInput,
    correlationId: string
  ): Promise<IComplaint> {
    const complaint = await ComplaintRepository.findById(complaintId, {
      messId: new mongoose.Types.ObjectId(messId),
    });

    if (!complaint) {
      throw AppError.notFound('Complaint not found.', ErrorCode.NOT_FOUND);
    }

    const oldStatus = complaint.status;
    const newStatus = input.status;

    // Update status and history
    const update: Record<string, unknown> = {
      $set: {
        status: newStatus,
        ...(input.managerResponse ? { managerResponse: input.managerResponse.trim() } : {}),
        ...(newStatus === ComplaintStatus.RESOLVED ? { resolvedAt: new Date() } : {}),
      },
      $push: {
        history: {
          status: newStatus,
          changedBy: new mongoose.Types.ObjectId(managerId),
          note: input.note || input.managerResponse || '',
          timestamp: new Date(),
        },
      },
    };

    const updated = await ComplaintModel.findOneAndUpdate(
      { _id: complaintId, messId: new mongoose.Types.ObjectId(messId) },
      update,
      { returnDocument: 'after' }
    ).exec();

    if (!updated) {
      throw AppError.notFound('Complaint could not be updated.', ErrorCode.NOT_FOUND);
    }

    // Write audit log using AuditLogRepository.log
    await AuditLogRepository.log(
      managerId,
      'UPDATE_COMPLAINT_STATUS',
      'complaints',
      correlationId,
      `Changed complaint ${complaintId} status from ${oldStatus} to ${newStatus}`,
      complaintId
    );

    // Notify student about status change
    NotificationService.sendNotification({
      userId: updated.studentId,
      title: `Complaint Status: ${newStatus}`,
      message: `Your complaint "${updated.title}" is now marked as ${newStatus}.${
        input.managerResponse ? ` Response: "${input.managerResponse}"` : ''
      }`,
      eventKey: `complaint-status-${updated._id}-${newStatus}`,
      linkUrl: `/student/complaints`,
    }).catch((err) => logger.warn('Failed to send complaint status notification', correlationId, { err: err.message }));

    logger.info('Complaint status updated', correlationId, {
      complaintId,
      oldStatus,
      newStatus,
    });

    return updated;
  }
}

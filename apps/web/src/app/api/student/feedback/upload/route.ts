import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireAuth } from '@/server/middleware/guards';
import { StorageService } from '@/server/services/storageService';
import { AppError, ErrorCode } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';

export const POST = withApiHandler(async (req: NextRequest, { correlationId }) => {
  await requireAuth(req);

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      throw AppError.badRequest('No file provided in form data.', ErrorCode.BAD_REQUEST);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await StorageService.uploadImage(buffer, file.name);

    return createSuccessResponse(result, 'Image uploaded successfully', 201);
  } catch (err: any) {
    if (err instanceof AppError) {
      throw err;
    }
    logger.error('File upload failed', correlationId, { error: err.message });
    // Non-blocking upload fallback format
    return createSuccessResponse(
      { url: null, warning: 'Image upload failed. You may continue submitting feedback without image.' },
      'Upload warning',
      200
    );
  }
});

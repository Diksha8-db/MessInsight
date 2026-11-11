import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';

export const GET = withApiHandler(async () => {
  const healthData = {
    status: 'UP',
    service: 'messinsight-web',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
  };

  return createSuccessResponse(healthData, 'System is healthy and operational');
});


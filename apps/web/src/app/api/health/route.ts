import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { circuitBreaker } from '@/server/integrations/circuitBreaker';

export const GET = withApiHandler(async () => {
  const cbState = circuitBreaker.getState();
  const mlStatus =
    cbState === 'CLOSED' ? 'UP' : cbState === 'HALF_OPEN' ? 'DEGRADED' : 'DOWN';

  const healthData = {
    status: mlStatus === 'DOWN' ? 'DEGRADED' : 'UP',
    service: 'messinsight-web',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    circuitBreaker: cbState,
    mlStatus,
  };

  return createSuccessResponse(healthData, 'System is healthy and operational');
});


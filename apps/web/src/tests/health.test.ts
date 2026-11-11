import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../app/api/health/route';

describe('Health Check Route (GET /api/health)', () => {
  it('returns 200 OK with UP status and service identifier', async () => {
    const req = new NextRequest('http://localhost:3000/api/health');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('UP');
    expect(json.data.service).toBe('messinsight-web');
    expect(json.data.timestamp).toBeDefined();
    expect(typeof json.data.uptimeSeconds).toBe('number');
  });
});


import { it, expect, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { signedUrl, uploadAudio } from '../tts/r2.mjs';
it('URL nghe chỉ GET, có chữ ký, hạn 7 ngày và đường dẫn đã encode', () => {
  const config = { account: 'account-test', bucket: 'bucket-test', key: 'bai-giang/loi-phat-day/a/v2-12345678/vi-charon.mp3', id: 'id-test', secret: 'secret-test', now: new Date('2026-11-15T00:00:00Z') };
  const url = new URL(signedUrl(config));
  expect(url.searchParams.get('X-Amz-Expires')).toBe('604800');
  expect(url.searchParams.get('X-Amz-Credential')).toBe('id-test/20261115/auto/s3/aws4_request');
  expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[a-f0-9]{64}$/);
  expect(url.href).not.toContain('secret-test');
  expect(signedUrl(config)).toBe(signedUrl(config));
  expect(() => signedUrl({ ...config, expires: 604801 })).toThrow();
});

it('khóa đã có: bỏ qua cùng SHA-256, chặn ghi đè nội dung khác', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vandao-r2-test-')), file = join(dir, 'sample.mp3');
  writeFileSync(file, 'audio-test');
  vi.stubEnv('CF_STAGING_API_TOKEN', 'token-test'); vi.stubEnv('CF_STAGING_ACCOUNT_ID', 'account-test');
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ success: true, result: { id: 'id-test' } }))
    .mockResolvedValueOnce(new Response('audio-test'))
    .mockResolvedValueOnce(new Response('different-audio'));
  vi.stubGlobal('fetch', fetchMock);
  try {
    const key = 'bai-giang/loi-phat-day/a/v2-12345678/vi-sadaltager.mp3';
    expect(await uploadAudio(file, key)).toMatchObject({ key, skipped: true });
    await expect(uploadAudio(file, key)).rejects.toThrow('không ghi đè');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); rmSync(dir, { recursive: true }); }
});

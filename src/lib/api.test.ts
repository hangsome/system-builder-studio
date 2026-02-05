import { describe, it, expect, beforeEach } from 'vitest';
 import { activateLicense, verifyLicense, setApiConfig, getApiConfig } from './api';
 
 describe('api', () => {
   beforeEach(() => {
     // 确保使用 mock 模式
     setApiConfig({ useMock: true });
   });
 
   describe('activateLicense (mock mode)', () => {
     it('should activate valid personal license', async () => {
       const result = await activateLicense('SIMU-P001-TEST-0001', 'test-device-id');
       
       expect(result.success).toBe(true);
       expect(result.licenseType).toBe('personal');
       expect(result.message).toBe('激活成功！');
     });
 
     it('should activate valid teacher license', async () => {
       const result = await activateLicense('SIMU-T001-TEST-0001', 'test-device-id');
       
       expect(result.success).toBe(true);
       expect(result.licenseType).toBe('teacher');
     });
 
     it('should reject invalid license key', async () => {
       const result = await activateLicense('INVALID-KEY-1234-5678', 'test-device-id');
       
       expect(result.success).toBe(false);
       expect(result.error).toContain('无效');
     });
 
     it('should reject already used license', async () => {
       // First activation
       await activateLicense('SIMU-P002-TEST-0002', 'device-1');
       
       // Second activation attempt
       const result = await activateLicense('SIMU-P002-TEST-0002', 'device-2');
       
       expect(result.success).toBe(false);
       expect(result.error).toContain('已在其他设备上激活');
     });
   });
 
   describe('verifyLicense (mock mode)', () => {
     it('should verify existing license', async () => {
       const result = await verifyLicense('SIMU-T002-TEST-0002', 'test-device-id');
       
       expect(result.valid).toBe(true);
       expect(result.licenseType).toBe('teacher');
     });
 
     it('should reject non-existent license', async () => {
       const result = await verifyLicense('SIMU-XXXX-XXXX-XXXX', 'test-device-id');
       
       expect(result.valid).toBe(false);
     });
   });
 
   describe('config', () => {
     it('should get and set config', () => {
       const originalConfig = getApiConfig();
       expect(originalConfig.useMock).toBe(true);
       
       setApiConfig({ useMock: false, baseUrl: 'https://test.com' });
       const newConfig = getApiConfig();
       
       expect(newConfig.useMock).toBe(false);
       expect(newConfig.baseUrl).toBe('https://test.com');
       
       // Reset
       setApiConfig({ useMock: true, baseUrl: 'https://api.your-domain.com' });
     });
   });
 });
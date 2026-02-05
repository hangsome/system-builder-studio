import { describe, it, expect, beforeEach } from 'vitest';
 import { generateDeviceFingerprint, getDeviceId } from './deviceFingerprint';
 
 describe('deviceFingerprint', () => {
   beforeEach(() => {
     localStorage.clear();
   });
 
   describe('generateDeviceFingerprint', () => {
     it('should generate a 32-character hex string', async () => {
       const fingerprint = await generateDeviceFingerprint();
       
       expect(fingerprint).toHaveLength(32);
       expect(/^[a-f0-9]+$/.test(fingerprint)).toBe(true);
     });
 
     it('should generate consistent fingerprints', async () => {
       const fp1 = await generateDeviceFingerprint();
       const fp2 = await generateDeviceFingerprint();
       
       // Same browser should produce same fingerprint
       expect(fp1).toBe(fp2);
     });
   });
 
   describe('getDeviceId', () => {
     it('should return stored device ID if exists', async () => {
       const storedId = 'stored-device-id-12345678901234';
       localStorage.setItem('simu_device_id', storedId);
       
       const deviceId = await getDeviceId();
       
       expect(deviceId).toBe(storedId);
     });
 
     it('should generate and store new device ID if not exists', async () => {
       expect(localStorage.getItem('simu_device_id')).toBe(null);
       
       const deviceId = await getDeviceId();
       
       expect(deviceId).toHaveLength(32);
       expect(localStorage.getItem('simu_device_id')).toBe(deviceId);
     });
 
     it('should return same device ID on subsequent calls', async () => {
       const id1 = await getDeviceId();
       const id2 = await getDeviceId();
       
       expect(id1).toBe(id2);
     });
   });
 });
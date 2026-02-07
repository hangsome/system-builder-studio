 import { describe, it, expect, beforeEach } from 'vitest';
 import {
   validateLicenseFormat,
   parseLicenseType,
   getLicenseDisplayName,
   getFeatureAccess,
   saveLicenseState,
   clearLicenseState,
   isActivated,
   isExpired,
   LicenseState,
 } from './license';
 
 describe('license', () => {
   beforeEach(() => {
     // 清理 localStorage
     localStorage.clear();
   });
 
   describe('validateLicenseFormat', () => {
     it('should validate correct license format', () => {
       expect(validateLicenseFormat('SIMU-P001-TEST-0001')).toBe(true);
       expect(validateLicenseFormat('SIMU-T001-ABCD-1234')).toBe(true);
       expect(validateLicenseFormat('simu-p001-test-0001')).toBe(true); // lowercase
     });
 
     it('should reject invalid license format', () => {
       expect(validateLicenseFormat('')).toBe(false);
       expect(validateLicenseFormat('INVALID')).toBe(false);
       expect(validateLicenseFormat('SIMU-P001-TEST')).toBe(false); // too short
       expect(validateLicenseFormat('SIMU-P001-TEST-00011')).toBe(false); // too long
       expect(validateLicenseFormat('ABCD-P001-TEST-0001')).toBe(false); // wrong prefix
     });
   });
 
   describe('parseLicenseType', () => {
     it('should parse personal license type', () => {
       expect(parseLicenseType('SIMU-P001-TEST-0001')).toBe('personal');
       expect(parseLicenseType('SIMU-PABC-TEST-0001')).toBe('personal');
     });
 
     it('should parse teacher license type', () => {
       expect(parseLicenseType('SIMU-T001-TEST-0001')).toBe('teacher');
       expect(parseLicenseType('SIMU-TABC-TEST-0001')).toBe('teacher');
     });
 
     it('should default to personal for unknown types', () => {
       expect(parseLicenseType('SIMU-X001-TEST-0001')).toBe('personal');
     });
 
     it('should return trial for invalid format', () => {
       expect(parseLicenseType('INVALID')).toBe('trial');
       expect(parseLicenseType('')).toBe('trial');
     });
   });
 
   describe('getLicenseDisplayName', () => {
     it('should return correct display names', () => {
       expect(getLicenseDisplayName('trial')).toBe('体验版');
       expect(getLicenseDisplayName('personal')).toBe('个人版');
       expect(getLicenseDisplayName('teacher')).toBe('教师版');
     });
   });
 
   describe('getFeatureAccess', () => {
     it('should return restricted access for trial', () => {
       const access = getFeatureAccess('trial');
       expect(access.maxScenarios).toBe(1);
       expect(access.canSave).toBe(false);
       expect(access.canExport).toBe(false);
       expect(access.showUpgradePrompt).toBe(true);
     });
 
     it('should return full access for personal', () => {
       const access = getFeatureAccess('personal');
       expect(access.maxScenarios).toBe(Infinity);
       expect(access.canSave).toBe(true);
       expect(access.canExport).toBe(false);
       expect(access.showUpgradePrompt).toBe(false);
     });
 
     it('should return full access for teacher', () => {
       const access = getFeatureAccess('teacher');
       expect(access.maxScenarios).toBe(Infinity);
       expect(access.canSave).toBe(true);
       expect(access.canExport).toBe(true);
       expect(access.showUpgradePrompt).toBe(false);
     });
   });
 
   describe('isActivated', () => {
     it('should return true for activated license', () => {
      const state: LicenseState = {
        licenseKey: 'SIMU-P001-TEST-0001',
        licenseType: 'personal',
        deviceId: 'test-device',
        activatedAt: new Date().toISOString(),
        expiresAt: null,
        remainingDevices: 0,
        lastVerifiedAt: new Date().toISOString(),
      };
      expect(isActivated(state)).toBe(true);
    });
 
     it('should return false for trial', () => {
      const state: LicenseState = {
        licenseKey: null,
        licenseType: 'trial',
        deviceId: 'test-device',
        activatedAt: null,
        expiresAt: null,
        remainingDevices: null,
        lastVerifiedAt: null,
      };
      expect(isActivated(state)).toBe(false);
    });
  });
 
   describe('isExpired', () => {
     it('should return false when no expiration', () => {
      const state: LicenseState = {
        licenseKey: 'SIMU-P001-TEST-0001',
        licenseType: 'personal',
        deviceId: 'test-device',
        activatedAt: new Date().toISOString(),
        expiresAt: null,
        remainingDevices: 0,
        lastVerifiedAt: new Date().toISOString(),
      };
      expect(isExpired(state)).toBe(false);
    });
 
     it('should return true when expired', () => {
      const state: LicenseState = {
        licenseKey: 'SIMU-P001-TEST-0001',
        licenseType: 'personal',
        deviceId: 'test-device',
        activatedAt: new Date().toISOString(),
        expiresAt: '2020-01-01T00:00:00.000Z', // past date
        remainingDevices: 0,
        lastVerifiedAt: new Date().toISOString(),
      };
      expect(isExpired(state)).toBe(true);
    });
 
     it('should return false when not expired', () => {
       const futureDate = new Date();
       futureDate.setFullYear(futureDate.getFullYear() + 1);
       
      const state: LicenseState = {
        licenseKey: 'SIMU-P001-TEST-0001',
        licenseType: 'personal',
        deviceId: 'test-device',
        activatedAt: new Date().toISOString(),
        expiresAt: futureDate.toISOString(),
        remainingDevices: 0,
        lastVerifiedAt: new Date().toISOString(),
      };
      expect(isExpired(state)).toBe(false);
    });
  });
 
   describe('saveLicenseState and clearLicenseState', () => {
     it('should save license state to localStorage', () => {
      saveLicenseState({
        licenseKey: 'SIMU-P001-TEST-0001',
        licenseType: 'personal',
        activatedAt: '2024-01-01T00:00:00.000Z',
        expiresAt: null,
        remainingDevices: 0,
        lastVerifiedAt: '2024-01-01T00:00:00.000Z',
      });
 
       expect(localStorage.getItem('simu_license_key')).toBe('SIMU-P001-TEST-0001');
       expect(localStorage.getItem('simu_license_type')).toBe('personal');
     });
 
     it('should clear license state from localStorage', () => {
      saveLicenseState({
        licenseKey: 'SIMU-P001-TEST-0001',
        licenseType: 'personal',
        activatedAt: '2024-01-01T00:00:00.000Z',
        expiresAt: null,
        remainingDevices: 0,
        lastVerifiedAt: '2024-01-01T00:00:00.000Z',
      });
 
       clearLicenseState();
 
       expect(localStorage.getItem('simu_license_key')).toBe(null);
       expect(localStorage.getItem('simu_license_type')).toBe(null);
     });
   });
 });

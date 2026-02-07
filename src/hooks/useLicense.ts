import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LicenseState,
  LicenseType,
  loadLicenseState,
  saveLicenseState,
  clearLicenseState,
  validateLicenseFormat,
  isActivated,
  isExpired,
  getFeatureAccess,
  FeatureAccess,
  isWithinOfflineGrace,
} from '@/lib/license';
import { activateLicense, verifyLicense } from '@/lib/api';
import { getDeviceId } from '@/lib/deviceFingerprint';
 
interface UseLicenseReturn {
  // 状态
  licenseState: LicenseState | null;
  isLoading: boolean;
  isActivated: boolean;
  isExpired: boolean;
  featureAccess: FeatureAccess;
  
  // 操作
  activate: (licenseKey: string) => Promise<{ success: boolean; message: string; remainingDevices?: number | null }>;
  deactivate: () => void;
  refresh: () => Promise<void>;
}

export function useLicense(): UseLicenseReturn {
  const [licenseState, setLicenseState] = useState<LicenseState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const licenseStateRef = useRef<LicenseState | null>(null);
  const VERIFY_INTERVAL_MS = 12 * 60 * 60 * 1000;
  
  const verifyAndSync = useCallback(async () => {
    const currentState = licenseStateRef.current;
    if (!currentState || !currentState.licenseKey || !isActivated(currentState)) return;
    
    const response = await verifyLicense(currentState.licenseKey, currentState.deviceId);
    
    if (response.valid) {
      const updatedState: LicenseState = {
        ...currentState,
        licenseType: response.licenseType || currentState.licenseType,
        expiresAt: response.expiresAt ?? currentState.expiresAt,
        remainingDevices: response.remainingDevices ?? currentState.remainingDevices,
        lastVerifiedAt: new Date().toISOString(),
      };
      
      saveLicenseState(updatedState);
      setLicenseState(updatedState);
      return;
    }
    
    // 离线时允许宽限期继续使用
    if (response.offline && isWithinOfflineGrace(currentState.lastVerifiedAt, currentState.activatedAt)) {
      return;
    }
    
    // 验证失败或超出宽限期，回退体验版
    clearLicenseState();
    setLicenseState({
      licenseKey: null,
      licenseType: 'trial',
      deviceId: currentState.deviceId,
      activatedAt: null,
      expiresAt: null,
      remainingDevices: null,
      lastVerifiedAt: currentState.lastVerifiedAt,
    });
  }, []);
  
  // 初始化加载
  useEffect(() => {
    loadLicenseState().then(state => {
      setLicenseState(state);
      licenseStateRef.current = state;
      setIsLoading(false);
      if (isActivated(state)) {
        verifyAndSync();
      }
    });
  }, [verifyAndSync]);
  
  useEffect(() => {
    licenseStateRef.current = licenseState;
  }, [licenseState]);
  
  // 周期性验证
  useEffect(() => {
    if (!licenseState?.licenseKey || !isActivated(licenseState)) return;
    
    const intervalId = window.setInterval(() => {
      verifyAndSync();
    }, VERIFY_INTERVAL_MS);
    
    return () => window.clearInterval(intervalId);
  }, [licenseState?.licenseKey, licenseState?.deviceId, verifyAndSync]);
   
  // 激活序列号
  const activate = useCallback(async (licenseKey: string) => {
    // 格式验证
    if (!validateLicenseFormat(licenseKey)) {
      return {
        success: false,
        message: '序列号格式不正确，请检查输入',
      };
    }
    
    setIsLoading(true);
    
    try {
      const deviceId = await getDeviceId();
      const response = await activateLicense(licenseKey, deviceId);
      
      if (response.success && response.licenseType) {
        const newState: LicenseState = {
          licenseKey: licenseKey.toUpperCase(),
          licenseType: response.licenseType,
          deviceId,
          activatedAt: new Date().toISOString(),
          expiresAt: response.expiresAt || null,
          remainingDevices: response.remainingDevices ?? null,
          lastVerifiedAt: new Date().toISOString(),
        };
        
        saveLicenseState(newState);
        setLicenseState(newState);
        
        return {
          success: true,
          message: response.message || '激活成功！',
          remainingDevices: newState.remainingDevices,
        };
      }
      
      return {
        success: false,
        message: response.error || '激活失败，请重试',
        remainingDevices: null,
      };
    } catch (error) {
      console.error('激活失败:', error);
      return {
        success: false,
        message: '激活过程中发生错误，请重试',
        remainingDevices: null,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // 取消激活
  const deactivate = useCallback(() => {
    clearLicenseState();
    getDeviceId().then(deviceId => {
      setLicenseState({
        licenseKey: null,
        licenseType: 'trial',
        deviceId,
        activatedAt: null,
        expiresAt: null,
        remainingDevices: null,
        lastVerifiedAt: null,
      });
    });
  }, []);
  
  // 刷新状态
  const refresh = useCallback(async () => {
    setIsLoading(true);
    const state = await loadLicenseState();
    setLicenseState(state);
    licenseStateRef.current = state;
    setIsLoading(false);
    if (isActivated(state)) {
      verifyAndSync();
    }
  }, [verifyAndSync]);
   
  // 计算派生状态
  const activated = licenseState ? isActivated(licenseState) : false;
  const expired = licenseState ? isExpired(licenseState) : false;
  const featureAccess = getFeatureAccess(
    (licenseState?.licenseType as LicenseType) || 'trial'
  );
  
  return {
    licenseState,
    isLoading,
    isActivated: activated,
    isExpired: expired,
    featureAccess,
    activate,
    deactivate,
    refresh,
  };
}

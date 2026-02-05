 import { useState, useEffect, useCallback } from 'react';
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
 } from '@/lib/license';
 import { activateLicense } from '@/lib/api';
 import { getDeviceId } from '@/lib/deviceFingerprint';
 
 interface UseLicenseReturn {
   // 状态
   licenseState: LicenseState | null;
   isLoading: boolean;
   isActivated: boolean;
   isExpired: boolean;
   featureAccess: FeatureAccess;
   
   // 操作
   activate: (licenseKey: string) => Promise<{ success: boolean; message: string }>;
   deactivate: () => void;
   refresh: () => Promise<void>;
 }
 
 export function useLicense(): UseLicenseReturn {
   const [licenseState, setLicenseState] = useState<LicenseState | null>(null);
   const [isLoading, setIsLoading] = useState(true);
   
   // 初始化加载
   useEffect(() => {
     loadLicenseState().then(state => {
       setLicenseState(state);
       setIsLoading(false);
     });
   }, []);
   
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
         };
         
         saveLicenseState(newState);
         setLicenseState(newState);
         
         return {
           success: true,
           message: response.message || '激活成功！',
         };
       }
       
       return {
         success: false,
         message: response.error || '激活失败，请重试',
       };
     } catch (error) {
       console.error('激活失败:', error);
       return {
         success: false,
         message: '激活过程中发生错误，请重试',
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
       });
     });
   }, []);
   
   // 刷新状态
   const refresh = useCallback(async () => {
     setIsLoading(true);
     const state = await loadLicenseState();
     setLicenseState(state);
     setIsLoading(false);
   }, []);
   
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
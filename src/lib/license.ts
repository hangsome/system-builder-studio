 import { getDeviceId } from './deviceFingerprint';
 
 // 序列号类型
 export type LicenseType = 'trial' | 'personal' | 'teacher';
 
 // 激活状态
 export interface LicenseState {
   licenseKey: string | null;
   licenseType: LicenseType;
   deviceId: string;
   activatedAt: string | null;
   expiresAt: string | null;
 }
 
 // 存储键名
 const STORAGE_KEYS = {
   LICENSE_KEY: 'simu_license_key',
   LICENSE_TYPE: 'simu_license_type',
   ACTIVATED_AT: 'simu_activated_at',
   EXPIRES_AT: 'simu_expires_at',
 };
 
 /**
  * 验证序列号格式
  * 格式：SIMU-XXXX-XXXX-XXXX
  */
 export function validateLicenseFormat(key: string): boolean {
   const pattern = /^SIMU-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
   return pattern.test(key.toUpperCase());
 }
 
 /**
  * 从序列号解析类型
  * P开头 = personal, T开头 = teacher
  */
 export function parseLicenseType(key: string): LicenseType {
   const parts = key.split('-');
   if (parts.length !== 4) return 'trial';
   
   const typeCode = parts[1].charAt(0).toUpperCase();
   switch (typeCode) {
     case 'P':
       return 'personal';
     case 'T':
       return 'teacher';
     default:
       return 'personal';
   }
 }
 
 /**
  * 保存激活状态到本地存储
  */
 export function saveLicenseState(state: Omit<LicenseState, 'deviceId'>): void {
   if (state.licenseKey) {
     localStorage.setItem(STORAGE_KEYS.LICENSE_KEY, state.licenseKey);
   }
   localStorage.setItem(STORAGE_KEYS.LICENSE_TYPE, state.licenseType);
   if (state.activatedAt) {
     localStorage.setItem(STORAGE_KEYS.ACTIVATED_AT, state.activatedAt);
   }
   if (state.expiresAt) {
     localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, state.expiresAt);
   }
 }
 
 /**
  * 从本地存储读取激活状态
  */
 export async function loadLicenseState(): Promise<LicenseState> {
   const deviceId = await getDeviceId();
   
   return {
     licenseKey: localStorage.getItem(STORAGE_KEYS.LICENSE_KEY),
     licenseType: (localStorage.getItem(STORAGE_KEYS.LICENSE_TYPE) as LicenseType) || 'trial',
     deviceId,
     activatedAt: localStorage.getItem(STORAGE_KEYS.ACTIVATED_AT),
     expiresAt: localStorage.getItem(STORAGE_KEYS.EXPIRES_AT),
   };
 }
 
 /**
  * 清除激活状态
  */
 export function clearLicenseState(): void {
   Object.values(STORAGE_KEYS).forEach(key => {
     localStorage.removeItem(key);
   });
 }
 
 /**
  * 检查是否已激活
  */
 export function isActivated(state: LicenseState): boolean {
   return state.licenseType !== 'trial' && !!state.licenseKey && !!state.activatedAt;
 }
 
 /**
  * 检查许可证是否过期
  */
 export function isExpired(state: LicenseState): boolean {
   if (!state.expiresAt) return false;
   return new Date(state.expiresAt) < new Date();
 }
 
 /**
  * 获取版本显示名称
  */
 export function getLicenseDisplayName(type: LicenseType): string {
   switch (type) {
     case 'personal':
       return '个人版';
     case 'teacher':
       return '教师版';
     case 'trial':
     default:
       return '体验版';
   }
 }
 
 /**
  * 获取版本功能限制
  */
 export interface FeatureAccess {
   maxScenarios: number;
   canSave: boolean;
   canExport: boolean;
   canUseAllComponents: boolean;
   showUpgradePrompt: boolean;
 }
 
 export function getFeatureAccess(type: LicenseType): FeatureAccess {
   switch (type) {
     case 'teacher':
       return {
         maxScenarios: Infinity,
         canSave: true,
         canExport: true,
         canUseAllComponents: true,
         showUpgradePrompt: false,
       };
     case 'personal':
       return {
         maxScenarios: Infinity,
         canSave: true,
         canExport: false,
         canUseAllComponents: true,
         showUpgradePrompt: false,
       };
     case 'trial':
     default:
       return {
         maxScenarios: 1,
         canSave: false,
         canExport: false,
         canUseAllComponents: false,
         showUpgradePrompt: true,
       };
   }
 }
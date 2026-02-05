 /**
  * API 调用封装
  * 用于与阿里云后端服务通信
  */
 
 // API 配置 - 部署后端后修改此处
 const API_CONFIG = {
   // 开发环境使用 mock 模式
   useMock: true,
   // 后端 API 地址（部署后修改）
   baseUrl: 'https://api.your-domain.com',
   // 请求超时时间（毫秒）
   timeout: 10000,
 };
 
 // API 响应类型
 export interface ActivateResponse {
   success: boolean;
   licenseType?: 'personal' | 'teacher';
   expiresAt?: string | null;
   message?: string;
   error?: string;
 }
 
 export interface VerifyResponse {
   valid: boolean;
   licenseType?: 'personal' | 'teacher';
   message?: string;
 }
 
 /**
  * Mock 数据 - 用于开发测试
  */
 const MOCK_LICENSES: Record<string, { type: 'personal' | 'teacher'; used: boolean }> = {
   'SIMU-P001-TEST-0001': { type: 'personal', used: false },
   'SIMU-P002-TEST-0002': { type: 'personal', used: false },
   'SIMU-T001-TEST-0001': { type: 'teacher', used: false },
   'SIMU-T002-TEST-0002': { type: 'teacher', used: false },
 };
 
 /**
  * 激活序列号
  */
 export async function activateLicense(
   licenseKey: string,
   deviceId: string
 ): Promise<ActivateResponse> {
   // Mock 模式
   if (API_CONFIG.useMock) {
     return mockActivate(licenseKey, deviceId);
   }
   
   // 真实 API 调用
   try {
     const response = await fetch(`${API_CONFIG.baseUrl}/api/activate`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({ licenseKey, deviceId }),
     });
     
     if (!response.ok) {
       throw new Error(`HTTP error! status: ${response.status}`);
     }
     
     return await response.json();
   } catch (error) {
     console.error('激活请求失败:', error);
     return {
       success: false,
       error: '网络连接失败，请检查网络后重试',
     };
   }
 }
 
 /**
  * 验证激活状态
  */
 export async function verifyLicense(
   licenseKey: string,
   deviceId: string
 ): Promise<VerifyResponse> {
   // Mock 模式
   if (API_CONFIG.useMock) {
     return mockVerify(licenseKey, deviceId);
   }
   
   // 真实 API 调用
   try {
     const response = await fetch(`${API_CONFIG.baseUrl}/api/verify`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({ licenseKey, deviceId }),
     });
     
     if (!response.ok) {
       throw new Error(`HTTP error! status: ${response.status}`);
     }
     
     return await response.json();
   } catch (error) {
     console.error('验证请求失败:', error);
     return {
       valid: false,
       message: '无法连接服务器',
     };
   }
 }
 
 /**
  * Mock 激活逻辑
  */
function mockActivate(licenseKey: string, _deviceId: string): Promise<ActivateResponse> {
   const key = licenseKey.toUpperCase();
   const license = MOCK_LICENSES[key];
   
  return new Promise<ActivateResponse>(resolve => {
     setTimeout(() => {
      if (!license) {
        resolve({
          success: false,
          error: '序列号无效，请检查输入是否正确',
        });
        return;
      }
      
      if (license.used) {
        resolve({
          success: false,
          error: '此序列号已在其他设备上激活',
        });
        return;
      }
      
      // 标记为已使用
      license.used = true;
      
      resolve({
        success: true,
        licenseType: license.type,
        expiresAt: null,
        message: '激活成功！',
      });
     }, 800);
  });
 }
 
 /**
  * Mock 验证逻辑
  */
 function mockVerify(licenseKey: string, _deviceId: string): VerifyResponse {
   const key = licenseKey.toUpperCase();
   const license = MOCK_LICENSES[key];
   
   return {
     valid: !!license,
     licenseType: license?.type,
   };
 }
 
 /**
  * 设置 API 配置
  */
 export function setApiConfig(config: Partial<typeof API_CONFIG>) {
   Object.assign(API_CONFIG, config);
 }
 
 /**
  * 获取当前 API 配置
  */
 export function getApiConfig() {
   return { ...API_CONFIG };
 }
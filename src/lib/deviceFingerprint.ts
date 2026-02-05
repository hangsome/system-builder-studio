 /**
  * 生成设备指纹
  * 使用浏览器特征组合生成唯一标识
  */
 
 async function getCanvasFingerprint(): Promise<string> {
   try {
     const canvas = document.createElement('canvas');
     const ctx = canvas.getContext('2d');
     if (!ctx) return '';
     
     canvas.width = 200;
     canvas.height = 50;
     
     ctx.textBaseline = 'top';
     ctx.font = '14px Arial';
     ctx.fillStyle = '#f60';
     ctx.fillRect(125, 1, 62, 20);
     ctx.fillStyle = '#069';
     ctx.fillText('Simulator', 2, 15);
     ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
     ctx.fillText('Fingerprint', 4, 17);
     
     return canvas.toDataURL();
   } catch {
     return '';
   }
 }
 
 function getWebGLInfo(): string {
   try {
     const canvas = document.createElement('canvas');
     const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
     if (!gl || !(gl instanceof WebGLRenderingContext)) return '';
     
     const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
     if (!debugInfo) return '';
     
     const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
     const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
     
     return `${vendor}~${renderer}`;
   } catch {
     return '';
   }
 }
 
 function getBrowserInfo(): string {
   const { userAgent, language, platform, hardwareConcurrency } = navigator;
   const { width, height, colorDepth } = screen;
   const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
   
   return [
     userAgent,
     language,
     platform,
     hardwareConcurrency,
     `${width}x${height}x${colorDepth}`,
     timezone,
   ].join('|');
 }
 
 async function hashString(str: string): Promise<string> {
   const encoder = new TextEncoder();
   const data = encoder.encode(str);
   const hashBuffer = await crypto.subtle.digest('SHA-256', data);
   const hashArray = Array.from(new Uint8Array(hashBuffer));
   return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
 }
 
 /**
  * 生成设备指纹
  * @returns 32位十六进制字符串
  */
 export async function generateDeviceFingerprint(): Promise<string> {
   const components = [
     await getCanvasFingerprint(),
     getWebGLInfo(),
     getBrowserInfo(),
   ];
   
   const fingerprint = components.join('###');
   const hash = await hashString(fingerprint);
   
   return hash.substring(0, 32);
 }
 
 /**
  * 获取或生成设备ID
  * 优先从本地存储读取，没有则生成新的
  */
 export async function getDeviceId(): Promise<string> {
   const STORAGE_KEY = 'simu_device_id';
   
   const stored = localStorage.getItem(STORAGE_KEY);
   if (stored) {
     return stored;
   }
   
   const deviceId = await generateDeviceFingerprint();
   localStorage.setItem(STORAGE_KEY, deviceId);
   
   return deviceId;
 }
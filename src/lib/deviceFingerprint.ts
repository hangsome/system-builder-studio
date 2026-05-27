 /**
  * 生成设备指纹
 * 使用浏览器特征组合生成唯一标识
 */

function canUseCanvasFingerprinting() {
  return typeof HTMLCanvasElement !== 'undefined' && !navigator.userAgent.toLowerCase().includes('jsdom');
}
 
 async function getCanvasFingerprint(): Promise<string> {
   try {
     if (!canUseCanvasFingerprinting()) return '';
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
     if (!canUseCanvasFingerprinting()) return '';
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
  if (!crypto?.subtle?.digest) {
    return hashStringFallback(str);
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return hashStringFallback(str);
  }
}

function hashStringFallback(str: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let h3 = 0x9e3779b9;
  let h4 = 0x85ebca6b;

  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = Math.imul(h2 ^ code, 0x85ebca6b);
    h3 = Math.imul(h3 ^ code, 0xc2b2ae35);
    h4 = Math.imul(h4 ^ code, 0x27d4eb2f);
  }

  return [h1, h2, h3, h4]
    .map(value => (value >>> 0).toString(16).padStart(8, '0'))
    .join('');
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

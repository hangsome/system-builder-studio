import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLicense } from '@/hooks/useLicense';
import { getLicenseDisplayName } from '@/lib/license';
import { isLicenseRequired } from '@/config/featureMode';
import { KeyRound, Sparkles, GraduationCap, User, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

 export default function Activation() {
   const navigate = useNavigate();
   const location = useLocation();
   const { activate, isLoading, isActivated, licenseState } = useLicense();
   const requireActivation = isLicenseRequired();
   const returnPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';
   
   const [licenseKey, setLicenseKey] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [success, setSuccess] = useState<string | null>(null);
   
   // 格式化输入（自动添加连字符）
   const formatLicenseKey = (value: string) => {
     // 移除非字母数字字符
     const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
     
     // 分段添加连字符
     const parts = [];
     if (cleaned.length > 0) parts.push(cleaned.substring(0, 4));
     if (cleaned.length > 4) parts.push(cleaned.substring(4, 8));
     if (cleaned.length > 8) parts.push(cleaned.substring(8, 12));
     if (cleaned.length > 12) parts.push(cleaned.substring(12, 16));
     
     return parts.join('-');
   };
   
   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const formatted = formatLicenseKey(e.target.value);
     setLicenseKey(formatted);
     setError(null);
     setSuccess(null);
   };
   
  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError('请输入序列号');
      return;
    }
    
    const result = await activate(licenseKey);
    
    if (result.success) {
      const remainingTip = typeof result.remainingDevices === 'number'
        ? `，剩余设备数：${result.remainingDevices}`
        : '';
      setSuccess(`${result.message}${remainingTip}`);
      setError(null);
      // 延迟跳转
      setTimeout(() => {
        navigate(returnPath, { replace: true });
      }, 1500);
     } else {
       setError(result.message);
       setSuccess(null);
     }
   };
   
   const handleTrialMode = () => {
     if (requireActivation) {
       setError('商业版需要先完成激活，不能以体验版进入。');
       return;
     }
     navigate('/');
   };
   
   // 如果已激活，显示激活状态
   if (isActivated && licenseState) {
     return (
       <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
         <Card className="w-full max-w-md">
           <CardHeader className="text-center">
             <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
               <CheckCircle2 className="w-8 h-8 text-primary" />
             </div>
             <CardTitle className="text-2xl">已激活</CardTitle>
             <CardDescription>
               您正在使用 {getLicenseDisplayName(licenseState.licenseType)}
             </CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
               <div className="flex justify-between">
                 <span className="text-muted-foreground">序列号</span>
                 <span className="font-mono">{licenseState.licenseKey}</span>
               </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">激活时间</span>
                <span>{licenseState.activatedAt ? new Date(licenseState.activatedAt).toLocaleDateString() : '-'}</span>
              </div>
              {typeof licenseState.remainingDevices === 'number' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">剩余设备数</span>
                  <span>{licenseState.remainingDevices}</span>
                </div>
              )}
            </div>
             
             <Button onClick={() => navigate('/')} className="w-full">
               进入模拟器
             </Button>
           </CardContent>
         </Card>
       </div>
     );
   }
   
   return (
     <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
       <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6">
         {/* 左侧：产品介绍 */}
         <div className="space-y-6">
           <div>
             <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
               <span className="text-4xl">📐</span>
               信息系统搭建模拟器
             </h1>
             <p className="text-muted-foreground">
               面向教育的物联网仿真平台，让学生轻松理解物联网架构与数据流转
             </p>
           </div>
           
           {/* 版本对比 */}
           <div className="space-y-4">
             <h2 className="text-lg font-semibold">选择适合您的版本</h2>
             
             <Card className="border-dashed">
               <CardHeader className="pb-2">
                 <div className="flex items-center gap-2">
                   <Sparkles className="w-5 h-5 text-muted-foreground" />
                   <CardTitle className="text-base">体验版</CardTitle>
                   <span className="text-xs bg-muted px-2 py-0.5 rounded">免费</span>
                 </div>
               </CardHeader>
               <CardContent className="text-sm text-muted-foreground">
                 <ul className="space-y-1">
                   <li>• 1个预设场景</li>
                   <li>• 基础组件库</li>
                   <li>• 无法保存项目</li>
                 </ul>
               </CardContent>
             </Card>
             
             <Card className="border-primary/50 bg-primary/5">
               <CardHeader className="pb-2">
                 <div className="flex items-center gap-2">
                   <User className="w-5 h-5 text-primary" />
                   <CardTitle className="text-base">个人版</CardTitle>
                   <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">推荐</span>
                 </div>
               </CardHeader>
               <CardContent className="text-sm text-muted-foreground">
                 <ul className="space-y-1">
                   <li>• 全部预设场景</li>
                   <li>• 完整组件库</li>
                   <li>• 本地保存项目</li>
                 </ul>
               </CardContent>
             </Card>
             
             <Card>
               <CardHeader className="pb-2">
                 <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-accent-foreground" />
                   <CardTitle className="text-base">教师版</CardTitle>
                 </div>
               </CardHeader>
               <CardContent className="text-sm text-muted-foreground">
                 <ul className="space-y-1">
                   <li>• 包含个人版全部功能</li>
                   <li>• 导出课件资料</li>
                   <li>• 多设备使用</li>
                 </ul>
               </CardContent>
             </Card>
           </div>
         </div>
         
         {/* 右侧：激活表单 */}
         <Card className="h-fit">
           <CardHeader>
             <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
               <KeyRound className="w-6 h-6 text-primary" />
             </div>
             <CardTitle className="text-center">激活产品</CardTitle>
             <CardDescription className="text-center">
               输入您的序列号以解锁完整功能
             </CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="space-y-2">
               <Label htmlFor="license-key">序列号</Label>
               <Input
                 id="license-key"
                 placeholder="SIMU-PXXX-XXXX-XXXX"
                 value={licenseKey}
                 onChange={handleInputChange}
                 className="font-mono text-center text-lg tracking-wider"
                 maxLength={19}
                 disabled={isLoading}
               />
               <p className="text-xs text-muted-foreground">
                 序列号格式：SIMU-PXXX-XXXX-XXXX 或 SIMU-TXXX-XXXX-XXXX
               </p>
             </div>
             
             {error && (
               <Alert variant="destructive">
                 <AlertCircle className="h-4 w-4" />
                 <AlertDescription>{error}</AlertDescription>
               </Alert>
             )}
             
             {success && (
              <Alert className="border-primary bg-primary/10 text-primary">
                 <CheckCircle2 className="h-4 w-4" />
                 <AlertDescription>{success}</AlertDescription>
               </Alert>
             )}
             
             <Button 
               onClick={handleActivate} 
               className="w-full" 
               size="lg"
               disabled={isLoading || !licenseKey.trim()}
             >
               {isLoading ? (
                 <>
                   <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                   激活中...
                 </>
               ) : (
                 '激活'
               )}
             </Button>
             
             {!requireActivation && (
               <>
                 <div className="relative">
                   <div className="absolute inset-0 flex items-center">
                     <span className="w-full border-t" />
                   </div>
                   <div className="relative flex justify-center text-xs uppercase">
                     <span className="bg-background px-2 text-muted-foreground">或者</span>
                   </div>
                 </div>
                <Button
                  variant="outline"
                  onClick={handleTrialMode}
                   className="w-full"
                   disabled={isLoading}
                 >
                   <Sparkles className="w-4 h-4 mr-2" />
                   以体验版模式进入
                 </Button>
               </>
             )}

             {requireActivation && (
               <div className="rounded-md border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
                 商业版需要激活后使用。公开课版本请使用教学版构建入口。
               </div>
             )}
             
             <p className="text-xs text-center text-muted-foreground">
               还没有序列号？
               <span className="text-primary ml-1">
                 请联系管理员获取
               </span>
             </p>
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }

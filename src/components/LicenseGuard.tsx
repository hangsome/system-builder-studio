 import { ReactNode } from 'react';
 import { Navigate, useLocation } from 'react-router-dom';
 import { useLicense } from '@/hooks/useLicense';
 import { Loader2 } from 'lucide-react';
 
 interface LicenseGuardProps {
   children: ReactNode;
   requireActivation?: boolean;
 }
 
 /**
  * 许可证路由保护组件
  * 
  * 注意：目前设置为允许体验版访问，只做状态加载
  * 如需强制激活，设置 requireActivation={true}
  */
 export function LicenseGuard({ children, requireActivation = false }: LicenseGuardProps) {
   const { isLoading, isActivated } = useLicense();
   const location = useLocation();
   
   // 加载中显示 loading
   if (isLoading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-background">
         <div className="text-center space-y-4">
           <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
           <p className="text-muted-foreground">加载中...</p>
         </div>
       </div>
     );
   }
   
   // 如果要求激活但未激活，重定向到激活页
   if (requireActivation && !isActivated) {
     return <Navigate to="/activation" state={{ from: location }} replace />;
   }
   
   return <>{children}</>;
 }
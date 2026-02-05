 import { useState } from 'react';
 import { useNavigate } from 'react-router-dom';
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
 } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { useLicense } from '@/hooks/useLicense';
 import { getLicenseDisplayName } from '@/lib/license';
 import { Sparkles, Lock, ArrowRight } from 'lucide-react';
 
 interface UpgradePromptProps {
   feature?: string;
   open?: boolean;
   onOpenChange?: (open: boolean) => void;
 }
 
 /**
  * 升级提示弹窗
  * 当体验版用户尝试使用付费功能时显示
  */
 export function UpgradePrompt({ 
   feature = '此功能', 
   open: controlledOpen,
   onOpenChange 
 }: UpgradePromptProps) {
   const navigate = useNavigate();
   const { licenseState } = useLicense();
   const [internalOpen, setInternalOpen] = useState(false);
   
   const isControlled = controlledOpen !== undefined;
   const open = isControlled ? controlledOpen : internalOpen;
   const setOpen = isControlled ? onOpenChange! : setInternalOpen;
   
   const handleUpgrade = () => {
     setOpen(false);
     navigate('/activation');
   };
   
   return (
     <Dialog open={open} onOpenChange={setOpen}>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-accent rounded-full flex items-center justify-center mb-2">
            <Lock className="w-6 h-6 text-accent-foreground" />
           </div>
           <DialogTitle className="text-center">升级解锁更多功能</DialogTitle>
           <DialogDescription className="text-center">
             {feature}仅限付费版本使用
           </DialogDescription>
         </DialogHeader>
         
         <div className="space-y-4 py-4">
           <div className="bg-muted rounded-lg p-4 text-sm">
             <p className="text-muted-foreground">
               您当前使用的是
               <span className="font-medium text-foreground mx-1">
                 {getLicenseDisplayName(licenseState?.licenseType || 'trial')}
               </span>
             </p>
           </div>
           
           <div className="space-y-2">
             <p className="text-sm font-medium">升级后可享：</p>
             <ul className="text-sm text-muted-foreground space-y-1">
               <li className="flex items-center gap-2">
                 <Sparkles className="w-4 h-4 text-primary" />
                 全部预设场景
               </li>
               <li className="flex items-center gap-2">
                 <Sparkles className="w-4 h-4 text-primary" />
                 完整组件库
               </li>
               <li className="flex items-center gap-2">
                 <Sparkles className="w-4 h-4 text-primary" />
                 保存和导出功能
               </li>
             </ul>
           </div>
         </div>
         
         <div className="flex gap-2">
           <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
             稍后再说
           </Button>
           <Button onClick={handleUpgrade} className="flex-1">
             立即激活
             <ArrowRight className="w-4 h-4 ml-1" />
           </Button>
         </div>
       </DialogContent>
     </Dialog>
   );
 }
 
 /**
  * 升级提示触发器 Hook
  */
 export function useUpgradePrompt() {
   const [open, setOpen] = useState(false);
   const [feature, setFeature] = useState('');
   
   const show = (featureName: string = '此功能') => {
     setFeature(featureName);
     setOpen(true);
   };
   
   const hide = () => {
     setOpen(false);
   };
   
   return {
     open,
     feature,
     show,
     hide,
     setOpen,
     UpgradePromptComponent: () => (
       <UpgradePrompt feature={feature} open={open} onOpenChange={setOpen} />
     ),
   };
 }
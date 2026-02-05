 import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Globe, Pause, Play, AlertTriangle } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
 import { useSimulatorStore } from '@/store/simulatorStore';
 import { simulateFlaskRoute } from '@/lib/simulationEngine';
 import { useShallow } from 'zustand/react/shallow';
 
// 温度报警阈值
const TEMPERATURE_THRESHOLD = 30;

 export const BrowserSimulator: React.FC = () => {
   const { serverConfig, database, isRunning } = useSimulatorStore(
     useShallow((state) => ({
       serverConfig: state.serverConfig,
       database: state.database,
       isRunning: state.isRunning,
     }))
   );
   
   const [url, setUrl] = useState(`http://${serverConfig.ip}:${serverConfig.port}/query`);
   const [response, setResponse] = useState<string>('');
   const [loading, setLoading] = useState(false);
   const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshInterval = 2000; // 2秒刷新一次
   const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
   const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);
 
   const handleRequest = useCallback(() => {
     setLoading(true);
     
     try {
       const urlObj = new URL(url);
       const path = urlObj.pathname + urlObj.search;
       
       const result = simulateFlaskRoute(
         { method: 'GET', path, body: {}, timestamp: new Date() },
         serverConfig,
         database
       );
       
       if (result.response.status === 200) {
         setResponse(JSON.stringify(result.response.body, null, 2));
       } else {
         setResponse(`错误 ${result.response.status}: ${JSON.stringify(result.response.body)}`);
       }
       setLastUpdate(new Date());
     } catch {
       setResponse('无效的URL格式');
     }
     
     setLoading(false);
   }, [url, serverConfig, database]);
 
   // 自动刷新逻辑
   useEffect(() => {
     if (autoRefresh && isRunning) {
       autoRefreshRef.current = setInterval(() => {
         handleRequest();
       }, refreshInterval);
     }
     
     return () => {
       if (autoRefreshRef.current) {
         clearInterval(autoRefreshRef.current);
       }
     };
   }, [autoRefresh, isRunning, refreshInterval, handleRequest]);
 
   // 从数据库直接获取最新数据用于简单展示
   const sensorLogs = (database.records['sensorlog'] || []) as Array<{
     id: number;
     sensor_id: number;
     value: number;
     timestamp: string;
   }>;
   const latestRecord = sensorLogs[sensorLogs.length - 1];
  
  // 判断是否温度过高需要报警
  const isOverheated = latestRecord && latestRecord.value > TEMPERATURE_THRESHOLD;
 
   return (
     <div className="flex flex-col h-full bg-background border rounded-lg overflow-hidden">
       {/* 浏览器标题栏 */}
       <div className="flex items-center justify-between px-3 py-2 bg-muted border-b">
         <div className="flex items-center gap-2">
           <div className="flex gap-1.5">
             <div className="w-3 h-3 rounded-full bg-destructive" />
             <div className="w-3 h-3 rounded-full bg-primary/60" />
             <div className="w-3 h-3 rounded-full bg-primary" />
           </div>
           <span className="text-xs text-muted-foreground ml-2">模拟浏览器</span>
         </div>
         
         {/* 自动刷新控制 */}
         <div className="flex items-center gap-2">
           <Badge variant={autoRefresh && isRunning ? 'default' : 'secondary'} className="text-xs">
             {autoRefresh && isRunning ? '自动刷新中' : '已暂停'}
           </Badge>
           <Button
             size="sm"
             variant="ghost"
             onClick={() => setAutoRefresh(!autoRefresh)}
             className="h-6 w-6 p-0"
           >
             {autoRefresh ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
           </Button>
         </div>
       </div>
       
       {/* 地址栏 */}
       <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
         <Globe className="w-4 h-4 text-muted-foreground" />
         <Input
           value={url}
           onChange={(e) => setUrl(e.target.value)}
           className="h-7 text-xs flex-1"
           placeholder="输入URL..."
         />
         <Button
           size="sm"
           variant="ghost"
           onClick={handleRequest}
           disabled={loading}
           className="h-7 px-2"
         >
           <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
         </Button>
       </div>
       
       {/* 页面内容 */}
       <div className="flex-1 p-4 overflow-auto">
         <div className="space-y-4">
           <div className="flex items-center justify-between">
             <h1 className="text-lg font-bold">🌡️ 教室温度监测</h1>
             {lastUpdate && (
               <span className="text-xs text-muted-foreground">
                 上次更新: {lastUpdate.toLocaleTimeString()}
               </span>
             )}
           </div>
          
          {/* 温度过高报警提示 */}
          {isOverheated && (
            <Alert variant="destructive" className="animate-pulse">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center gap-2">
                🔔 蜂鸣器报警中
              </AlertTitle>
              <AlertDescription>
                当前温度 {latestRecord.value.toFixed(1)}°C 超过阈值 {TEMPERATURE_THRESHOLD}°C，蜂鸣器已触发警报！
              </AlertDescription>
            </Alert>
          )}
           
           {/* 当前温度卡片 */}
          <div className={`p-4 rounded-lg text-center ${isOverheated ? 'bg-destructive/10 border border-destructive' : 'bg-muted'}`}>
             <div className="text-sm text-muted-foreground">当前温度</div>
            <div className={`text-4xl font-bold ${isOverheated ? 'text-destructive' : 'text-primary'}`}>
               {latestRecord ? `${latestRecord.value.toFixed(1)}°C` : '--'}
             </div>
            {isOverheated && (
              <div className="text-xs text-destructive mt-1 font-medium">
                ⚠️ 温度过高！
              </div>
            )}
             <div className="text-xs text-muted-foreground mt-1">
               {latestRecord ? `记录于 ${latestRecord.timestamp}` : '暂无数据'}
             </div>
             <div className="text-xs text-muted-foreground mt-1">
               共 {sensorLogs.length} 条记录
             </div>
           </div>
           
           {/* 历史记录表格 */}
           <div>
             <h2 className="text-sm font-semibold mb-2">历史记录 (最近10条)</h2>
             <div className="border rounded overflow-hidden">
               <table className="w-full text-xs">
                 <thead className="bg-muted">
                   <tr>
                     <th className="px-2 py-1 text-left">ID</th>
                     <th className="px-2 py-1 text-left">温度</th>
                     <th className="px-2 py-1 text-left">时间</th>
                   </tr>
                 </thead>
                 <tbody>
                   {sensorLogs.slice(-10).reverse().map((log) => (
                     <tr key={log.id} className="border-t">
                       <td className="px-2 py-1">{log.id}</td>
                       <td className="px-2 py-1">{log.value.toFixed(1)}°C</td>
                       <td className="px-2 py-1 text-muted-foreground">{log.timestamp}</td>
                     </tr>
                   ))}
                   {sensorLogs.length === 0 && (
                     <tr>
                       <td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">
                         暂无数据，请启动仿真
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
           </div>
           
           {/* API响应区域 */}
           {response && (
             <div>
               <h2 className="text-sm font-semibold mb-2">API响应 (/query)</h2>
               <pre className="p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                 {response}
               </pre>
             </div>
           )}
         </div>
       </div>
     </div>
   );
 };
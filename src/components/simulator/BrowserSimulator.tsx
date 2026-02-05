 import React, { useState } from 'react';
 import { RefreshCw, Globe } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { useSimulatorStore } from '@/store/simulatorStore';
 import { simulateFlaskRoute } from '@/lib/simulationEngine';
 
 export const BrowserSimulator: React.FC = () => {
   const { serverConfig, database } = useSimulatorStore();
   const [url, setUrl] = useState(`http://${serverConfig.ip}:${serverConfig.port}/query`);
   const [response, setResponse] = useState<string>('');
   const [loading, setLoading] = useState(false);
 
   const handleRequest = () => {
     setLoading(true);
     
     // 解析URL获取路径
     try {
       const urlObj = new URL(url);
       const path = urlObj.pathname + urlObj.search;
       
       // 模拟Flask请求
       const result = simulateFlaskRoute(
         { method: 'GET', path, body: {}, timestamp: new Date() },
         serverConfig,
         database
       );
       
       // 格式化响应
       if (result.response.status === 200) {
         setResponse(JSON.stringify(result.response.body, null, 2));
       } else {
         setResponse(`错误 ${result.response.status}: ${JSON.stringify(result.response.body)}`);
       }
     } catch (e) {
       setResponse('无效的URL格式');
     }
     
     setLoading(false);
   };
 
   // 从数据库直接获取最新数据用于简单展示
   const sensorLogs = (database.records['sensorlog'] || []) as Array<{
     id: number;
     sensor_id: number;
     value: number;
     timestamp: string;
   }>;
   const latestRecord = sensorLogs[sensorLogs.length - 1];
 
   return (
     <div className="flex flex-col h-full bg-background border rounded-lg overflow-hidden">
       {/* 浏览器标题栏 */}
       <div className="flex items-center gap-2 px-3 py-2 bg-muted border-b">
         <div className="flex gap-1.5">
           <div className="w-3 h-3 rounded-full bg-destructive" />
           <div className="w-3 h-3 rounded-full bg-primary/60" />
           <div className="w-3 h-3 rounded-full bg-primary" />
         </div>
         <span className="text-xs text-muted-foreground ml-2">模拟浏览器</span>
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
         {/* 简单的温度展示页面 */}
         <div className="space-y-4">
           <h1 className="text-lg font-bold">🌡️ 教室温度监测</h1>
           
           {/* 当前温度卡片 */}
           <div className="p-4 bg-muted rounded-lg text-center">
             <div className="text-sm text-muted-foreground">当前温度</div>
             <div className="text-4xl font-bold text-primary">
               {latestRecord ? `${latestRecord.value.toFixed(1)}°C` : '--'}
             </div>
             <div className="text-xs text-muted-foreground mt-1">
               {latestRecord ? `更新于 ${latestRecord.timestamp}` : '暂无数据'}
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
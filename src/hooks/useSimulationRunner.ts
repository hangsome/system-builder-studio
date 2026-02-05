 // 独立的仿真运行器钩子 - 在应用级别运行，不依赖UI组件
 import { useEffect, useRef, useCallback, useMemo } from 'react';
 import { useSimulatorStore } from '@/store/simulatorStore';
 import { componentDefinitions } from '@/data/componentDefinitions';
 import { 
   sensorConfigs, 
   generateSensorFluctuation, 
   simulateFlaskRoute 
 } from '@/lib/simulationEngine';
 import { validateSystem } from '@/lib/connectionValidator';
 import { useShallow } from 'zustand/react/shallow';
 
 export function useSimulationRunner() {
   const {
     isRunning,
     simulationSpeed,
     placedComponents,
     connections,
     routerConfig,
     serverConfig,
     database,
     updateDatabase,
     addLog,
     codeBurned,
     sensorValues,
     setSensorValue,
     autoFluctuation,
   } = useSimulatorStore(
     useShallow((state) => ({
       isRunning: state.isRunning,
       simulationSpeed: state.simulationSpeed,
       placedComponents: state.placedComponents,
       connections: state.connections,
       routerConfig: state.routerConfig,
       serverConfig: state.serverConfig,
       database: state.database,
       updateDatabase: state.updateDatabase,
       addLog: state.addLog,
       codeBurned: state.codeBurned,
       sensorValues: state.sensorValues,
       setSensorValue: state.setSensorValue,
       autoFluctuation: state.autoFluctuation,
     }))
   );
 
   const simulationRef = useRef<NodeJS.Timeout | null>(null);
   const dataFlowRef = useRef<NodeJS.Timeout | null>(null);
   const sensorValuesRef = useRef<Record<string, number>>({});
   
   // 同步 sensorValues 到 ref
   useEffect(() => {
     sensorValuesRef.current = sensorValues;
   }, [sensorValues]);
 
   // 获取传感器组件
   const sensorComponents = useMemo(() => {
     return placedComponents.filter((c) => {
       const def = componentDefinitions.find((d) => d.id === c.definitionId);
       return def?.category === 'sensor';
     });
   }, [placedComponents]);
 
  // 初始化传感器值
  useEffect(() => {
    sensorComponents.forEach((sensor) => {
      if (sensorValues[sensor.instanceId] === undefined) {
        const config = sensorConfigs[sensor.definitionId];
        setSensorValue(sensor.instanceId, config?.defaultValue ?? 25);
      }
    });
  }, [sensorComponents, sensorValues, setSensorValue]);

   // 获取电源状态
   const getPowerStatus = useCallback(() => {
     const validation = validateSystem(placedComponents, connections);
     return validation.powerStatus;
   }, [placedComponents, connections]);
 
   // 检查 IoT 模块连接状态
   const checkNetworkStatus = useCallback(() => {
     const powerStatus = getPowerStatus();
     const iotComponent = placedComponents.find(c => c.definitionId === 'iot-module');
     
     if (!iotComponent) return false;
     
     const iotPowered = powerStatus.get(iotComponent.instanceId) ?? false;
     
     // 检查 TX/RX 连接
     const iotConnections = connections.filter(
       c => c.fromComponent === iotComponent.instanceId || c.toComponent === iotComponent.instanceId
     );
     const hasTxRx = iotConnections.some(c => c.fromPin === 'tx' || c.toPin === 'tx') &&
                     iotConnections.some(c => c.fromPin === 'rx' || c.toPin === 'rx');
     
     return iotPowered && hasTxRx && !!routerConfig.ssid;
   }, [placedComponents, connections, routerConfig.ssid, getPowerStatus]);
 
   // 主仿真循环
   useEffect(() => {
     if (!isRunning) {
       if (simulationRef.current) clearInterval(simulationRef.current);
       if (dataFlowRef.current) clearInterval(dataFlowRef.current);
       return;
     }
 
     const networkConnected = checkNetworkStatus();
 
     // 传感器波动循环
     if (autoFluctuation) {
       simulationRef.current = setInterval(() => {
         const currentPowerStatus = getPowerStatus();
         sensorComponents.forEach(sensor => {
           const isPowered = currentPowerStatus.get(sensor.instanceId);
           if (!isPowered) return;
           
           const currentValue = sensorValuesRef.current[sensor.instanceId];
           if (currentValue !== undefined) {
             const newValue = generateSensorFluctuation(currentValue, sensor.definitionId);
             setSensorValue(sensor.instanceId, newValue);
           }
         });
       }, 2000 / simulationSpeed);
     }
 
     // 数据发送循环
     if (codeBurned && serverConfig.running && networkConnected) {
       dataFlowRef.current = setInterval(() => {
         const currentPowerStatus = getPowerStatus();
         
         sensorComponents.forEach(sensor => {
           const isPowered = currentPowerStatus.get(sensor.instanceId);
           if (!isPowered) {
             const def = componentDefinitions.find(d => d.id === sensor.definitionId);
             addLog({
               type: 'warning',
               message: `${def?.name} 未供电，无法读取数据`,
               source: 'micro:bit',
             });
             return;
           }
           
           const value = sensorValuesRef.current[sensor.instanceId];
           const def = componentDefinitions.find(d => d.id === sensor.definitionId);
           
           addLog({
             type: 'data',
             message: `读取 ${def?.name}: ${value?.toFixed(1) ?? '?'} ${sensorConfigs[sensor.definitionId]?.unit ?? ''}`,
             source: 'micro:bit',
           });
 
           const requestPath = `/upload?temperature=${value?.toFixed(1) ?? 0}`;
           const fullUrl = `http://${serverConfig.ip}:${serverConfig.port}${requestPath}`;
           
           addLog({
             type: 'info',
             message: `发送请求: GET ${fullUrl}`,
             source: 'IoT模块',
           });
           
           const result = simulateFlaskRoute(
             { method: 'GET', path: requestPath, timestamp: new Date() },
             serverConfig,
             database
           );
 
           if (result.response.status === 200) {
             const responseBody = result.response.body as { status?: string; id?: number; message?: string };
             addLog({
               type: 'info',
               message: `响应: ${result.response.status} OK - ${responseBody.message || '数据已保存'} (ID: ${responseBody.id})`,
               source: 'Flask',
             });
 
             if (result.updatedDatabase) {
               updateDatabase(result.updatedDatabase);
               addLog({
                 type: 'data',
                 message: `数据库已更新: sensorlog 表新增1条记录`,
                 source: 'SQLite',
               });
             }
           } else {
             const errorBody = result.response.body as { error?: string; path?: string; method?: string };
             addLog({
               type: 'error',
               message: `请求失败: ${result.response.status} - ${errorBody.error || '未知错误'} (路径: ${errorBody.path}, 方法: ${errorBody.method})`,
               source: 'Flask',
             });
           }
         });
       }, 3000 / simulationSpeed);
     }
 
     return () => {
       if (simulationRef.current) clearInterval(simulationRef.current);
       if (dataFlowRef.current) clearInterval(dataFlowRef.current);
     };
   }, [isRunning, simulationSpeed, autoFluctuation, codeBurned, serverConfig.running, serverConfig.ip, serverConfig.port, database, sensorComponents, checkNetworkStatus, getPowerStatus, addLog, updateDatabase, setSensorValue]);
 
   return null;
 }
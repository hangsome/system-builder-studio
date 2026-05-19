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
 import { findFaultyComponent, getComponentFaultMessage, isComponentFaulty } from '@/lib/faultModel';
 import {
   getActuatorPinMismatchMessage,
   getSensorPinMismatchMessage,
   getUploadMethodMismatchMessage,
 } from '@/lib/simulationDiagnostics';
 import { getClassroomTemperatureThreshold } from '@/lib/classroomThreshold';
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
      microbitCode,
      sensorValues,
      setSensorValue,
      updateComponentState,
      autoFluctuation,
      demoSweepActive,
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
        microbitCode: state.microbitCode,
        sensorValues: state.sensorValues,
        setSensorValue: state.setSensorValue,
        updateComponentState: state.updateComponentState,
        autoFluctuation: state.autoFluctuation,
        demoSweepActive: state.demoSweepActive,
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

  const actuatorComponents = useMemo(() => {
    return placedComponents.filter((c) => {
      const def = componentDefinitions.find((d) => d.id === c.definitionId);
      return def?.category === 'actuator';
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
      const iotComponent = placedComponents.find(
        c => c.definitionId === 'iot-module' || c.definitionId === 'obloq'
      );

     if (!iotComponent) return false;

     const iotPowered = powerStatus.get(iotComponent.instanceId) ?? false;

     const hasMatchedSerialConnection = (iotPin: 'tx' | 'rx', expansionPin: 'p15' | 'p16') =>
       connections.some((connection) => {
         const iotOnFromSide =
           connection.fromComponent === iotComponent.instanceId && connection.fromPin === iotPin;
         const iotOnToSide =
           connection.toComponent === iotComponent.instanceId && connection.toPin === iotPin;

         if (!iotOnFromSide && !iotOnToSide) {
           return false;
         }

         const otherComponentId = iotOnFromSide ? connection.toComponent : connection.fromComponent;
         const otherPinId = iotOnFromSide ? connection.toPin : connection.fromPin;
         const otherComponent = placedComponents.find((component) => component.instanceId === otherComponentId);

         return otherComponent?.definitionId === 'expansion-board' && otherPinId === expansionPin;
       });

     const hasTxRx =
       hasMatchedSerialConnection('tx', 'p15') &&
       hasMatchedSerialConnection('rx', 'p16');

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

     // 传感器值更新循环：演示扫描优先（让温度从 ~24 平滑升到 ~33 再回落，跨过 30°C 阈值）
     if (demoSweepActive) {
       simulationRef.current = setInterval(() => {
         const currentPowerStatus = getPowerStatus();
         const t = Date.now() / 1000;
         // 24 秒一个完整正弦周期，温度区间 24.5 - 32.5
         const sweepValue = 28.5 + 4 * Math.sin((2 * Math.PI * t) / 24);
         sensorComponents.forEach(sensor => {
           if (sensor.definitionId !== 'temp-humidity-sensor') return;
           const isPowered = currentPowerStatus.get(sensor.instanceId);
           if (!isPowered || isComponentFaulty(sensor)) return;
           setSensorValue(sensor.instanceId, Number(sweepValue.toFixed(1)));
         });
       }, 1000 / simulationSpeed);
     } else if (autoFluctuation) {
       simulationRef.current = setInterval(() => {
          const currentPowerStatus = getPowerStatus();
          sensorComponents.forEach(sensor => {
            const isPowered = currentPowerStatus.get(sensor.instanceId);
            if (!isPowered || isComponentFaulty(sensor)) return;

           const currentValue = sensorValuesRef.current[sensor.instanceId];
           if (currentValue !== undefined) {
             const newValue = generateSensorFluctuation(currentValue, sensor.definitionId);
             setSensorValue(sensor.instanceId, newValue);
           }
         });
       }, 2000 / simulationSpeed);
     }

     // 数据发送循环
      if (codeBurned) {
        dataFlowRef.current = setInterval(() => {
          const currentPowerStatus = getPowerStatus();
          const microbitFault = findFaultyComponent(placedComponents, ['microbit']);
          const iotFault = findFaultyComponent(placedComponents, ['iot-module', 'obloq']);
          const routerFault = findFaultyComponent(placedComponents, ['router']);
          const serverFault = findFaultyComponent(placedComponents, ['web-server']);
          const databaseFault = findFaultyComponent(placedComponents, ['database']);

          if (microbitFault) {
            addLog({
              type: 'error',
              message: getComponentFaultMessage(microbitFault, '智能终端故障，无法执行采集和上传程序'),
              source: '智能终端',
            });
            return;
          }

          if (!networkConnected || iotFault || routerFault) {
            addLog({
              type: 'warning',
              message: getComponentFaultMessage(iotFault || routerFault, '网络链路不可用，HTTP 请求无法到达 Flask 服务器'),
              source: 'IOT模块',
            });
            return;
          }

          if (!serverConfig.running || serverFault) {
            addLog({
              type: 'error',
              message: getComponentFaultMessage(serverFault, 'Flask 服务不可用，无法接收上传请求'),
              source: 'Flask',
            });
            return;
          }

          sensorComponents.forEach(sensor => {
            const isPowered = currentPowerStatus.get(sensor.instanceId);
            const sensorFault = isComponentFaulty(sensor);
            const pinMismatchMessage = getSensorPinMismatchMessage(sensor, placedComponents, connections, microbitCode);

            if (!isPowered) {
              const def = componentDefinitions.find(d => d.id === sensor.definitionId);
              addLog({
               type: 'warning',
               message: `${def?.name} 未供电，无法读取数据`,
               source: '智能终端',
              });
              return;
            }

            if (sensorFault) {
              const def = componentDefinitions.find(d => d.id === sensor.definitionId);
              addLog({
                type: 'error',
                message: getComponentFaultMessage(sensor, `${def?.name || '传感器'} 故障，采集端无有效数据输出`),
                source: '传感器',
              });
              return;
            }

            if (pinMismatchMessage) {
              addLog({
                type: 'warning',
                message: pinMismatchMessage,
                source: '智能终端',
              });
              return;
            }

            const uploadMethodMismatch = getUploadMethodMismatchMessage(microbitCode);
            if (uploadMethodMismatch) {
              addLog({
                type: 'warning',
                message: uploadMethodMismatch,
                source: '智能终端',
              });
              return;
            }

           const value = sensorValuesRef.current[sensor.instanceId];
           const def = componentDefinitions.find(d => d.id === sensor.definitionId);
           const numericValue = Number(value ?? 0);

           addLog({
             type: 'data',
             message: `读取 ${def?.name}: ${value?.toFixed(1) ?? '?'} ${sensorConfigs[sensor.definitionId]?.unit ?? ''}`,
             source: '智能终端',
           });

           const requestPath = `/upload?id=1&val=${numericValue.toFixed(1)}`;
           const fullUrl = `http://${serverConfig.ip}:${serverConfig.port}${requestPath}`;

           addLog({
             type: 'info',
             message: `发送请求: GET ${fullUrl}`,
             source: 'IOT模块',
           });

           const result = simulateFlaskRoute(
             {
               method: 'GET',
               path: requestPath,
               timestamp: new Date(),
               microbitCode,
             },
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
                if (databaseFault) {
                  addLog({
                    type: 'error',
                    message: getComponentFaultMessage(databaseFault, 'SQLite 数据库故障，数据未能写入 sensorlog 表'),
                    source: 'SQLite',
                  });
                  return;
                }

                updateDatabase(result.updatedDatabase);
                addLog({
                  type: 'data',
                 message: `数据库已更新: sensorlog 表新增1条记录`,
                 source: 'SQLite',
               });

                const primaryActuator = actuatorComponents[0];
                if (primaryActuator) {
                  const actuatorMismatchMessage = getActuatorPinMismatchMessage(
                    primaryActuator,
                    placedComponents,
                    connections,
                    microbitCode
                  );
                  const temperatureThreshold = getClassroomTemperatureThreshold(microbitCode);
                  const aboveThreshold = numericValue > temperatureThreshold;
                  const actuatorReady = !isComponentFaulty(primaryActuator) && !actuatorMismatchMessage;
                  updateComponentState(primaryActuator.instanceId, { active: aboveThreshold && actuatorReady });

                  if (aboveThreshold && isComponentFaulty(primaryActuator)) {
                    addLog({
                      type: 'error',
                      message: getComponentFaultMessage(primaryActuator, '执行器故障：服务器已判断温度超阈值，但蜂鸣器没有动作'),
                      source: '执行器',
                    });
                  } else if (aboveThreshold && actuatorMismatchMessage) {
                    addLog({
                      type: 'warning',
                      message: actuatorMismatchMessage,
                      source: '执行器',
                    });
                  } else if (aboveThreshold) {
                    addLog({
                      type: 'data',
                      message: `温度超过 ${temperatureThreshold}°C，服务器返回 BUZZER_ON，蜂鸣器已响应`,
                      source: '执行器',
                    });
                  }
                }
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
    }, [isRunning, simulationSpeed, autoFluctuation, demoSweepActive, codeBurned, microbitCode, serverConfig, database, placedComponents, connections, sensorComponents, actuatorComponents, checkNetworkStatus, getPowerStatus, addLog, updateDatabase, setSensorValue, updateComponentState]);

   return null;
 }

import type { ComponentCategory, PlacedComponent } from '@/types/simulator';

export type TraceFaultKey = 'sensor' | 'microbit' | 'network' | 'server' | 'database' | 'browser';

export interface FaultPreset {
  faultType: NonNullable<PlacedComponent['state']>['faultType'];
  message: string;
}

export const traceFaultLabels: Record<TraceFaultKey, string> = {
  sensor: '采集端故障',
  microbit: '智能终端故障',
  network: '网络链路故障',
  server: '服务器故障',
  database: '数据库故障',
  browser: '浏览器故障',
};

export function isComponentFaulty(component?: PlacedComponent | null) {
  return component?.state?.fault === true;
}

export function getComponentFaultMessage(component: PlacedComponent | undefined | null, fallback: string) {
  return component?.state?.faultMessage || fallback;
}

export function findFaultyComponent(
  components: PlacedComponent[],
  definitionIds: string[]
) {
  return components.find((component) => definitionIds.includes(component.definitionId) && isComponentFaulty(component));
}

export function getFaultPreset(definitionId: string, category: ComponentCategory, displayName: string): FaultPreset {
  if (definitionId === 'microbit') {
    return {
      faultType: 'code',
      message: `${displayName} 故障：程序未能持续读取或上传数据`,
    };
  }

  if (definitionId === 'router' || definitionId === 'iot-module' || definitionId === 'obloq') {
    return {
      faultType: 'network',
      message: `${displayName} 故障：网络链路中断，HTTP 请求无法到达服务器`,
    };
  }

  if (definitionId === 'web-server') {
    return {
      faultType: 'service',
      message: `${displayName} 故障：Flask 服务无法接收请求`,
    };
  }

  if (definitionId === 'database') {
    return {
      faultType: 'storage',
      message: `${displayName} 故障：数据无法写入或查询 SQLite`,
    };
  }

  if (definitionId === 'browser' || definitionId === 'mobile-client') {
    return {
      faultType: 'client',
      message: `${displayName} 故障：用户端无法正确查询或展示实时数据`,
    };
  }

  if (category === 'sensor') {
    return {
      faultType: 'hardware',
      message: `${displayName} 故障：采集端无有效数据输出`,
    };
  }

  if (category === 'actuator') {
    return {
      faultType: 'hardware',
      message: `${displayName} 故障：执行器无法响应控制信号`,
    };
  }

  return {
    faultType: 'hardware',
    message: `${displayName} 故障：组件不可用`,
  };
}

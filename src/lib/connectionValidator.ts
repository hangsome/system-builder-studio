// 连接验证器 - 阶段二核心功能
import { Connection, PlacedComponent, Pin } from '@/types/simulator';
import { componentDefinitions } from '@/data/componentDefinitions';

const EXPANSION_SERIAL_RX_PIN = 'p15';
const EXPANSION_SERIAL_TX_PIN = 'p16';

export interface ValidationResult {
  valid: boolean;
  type: 'power' | 'ground' | 'data' | 'serial' | 'wireless';
  errors: string[];
  warnings: string[];
}

// 获取引脚定义
export function getPinDefinition(componentId: string, pinId: string, placedComponents: PlacedComponent[]): Pin | null {
  const component = placedComponents.find(c => c.instanceId === componentId);
  if (!component) return null;
  
  const definition = componentDefinitions.find(d => d.id === component.definitionId);
  if (!definition) return null;
  
  return definition.pins.find(p => p.id === pinId) || null;
}

// 验证单个连接
export function validateConnection(
  fromComponentId: string,
  fromPinId: string,
  toComponentId: string,
  toPinId: string,
  placedComponents: PlacedComponent[],
  existingConnections: Connection[]
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    type: 'data',
    errors: [],
    warnings: [],
  };

  const fromPin = getPinDefinition(fromComponentId, fromPinId, placedComponents);
  const toPin = getPinDefinition(toComponentId, toPinId, placedComponents);

  if (!fromPin || !toPin) {
    result.valid = false;
    result.errors.push('无法找到引脚定义');
    return result;
  }

  // 检查是否连接自身
  if (fromComponentId === toComponentId) {
    result.valid = false;
    result.errors.push('不能连接到同一个组件');
    return result;
  }

  // 检查引脚是否已被连接
  const fromPinConnected = existingConnections.some(
    c => (c.fromComponent === fromComponentId && c.fromPin === fromPinId) ||
         (c.toComponent === fromComponentId && c.toPin === fromPinId)
  );
  const toPinConnected = existingConnections.some(
    c => (c.fromComponent === toComponentId && c.fromPin === toPinId) ||
         (c.toComponent === toComponentId && c.toPin === toPinId)
  );

  if (fromPinConnected) {
    result.valid = false;
    result.errors.push(`${fromPin.name} 引脚已被占用`);
  }
  if (toPinConnected) {
    result.valid = false;
    result.errors.push(`${toPin.name} 引脚已被占用`);
  }

  if (!result.valid) {
    return result;
  }

  const isSerialPin = (pin: Pin) =>
    pin.type === 'serial_tx' ||
    pin.type === 'serial_rx' ||
    pin.id === 'tx' ||
    pin.id === 'rx' ||
    pin.id === EXPANSION_SERIAL_TX_PIN ||
    pin.id === EXPANSION_SERIAL_RX_PIN;

  // 确定连接类型并验证
  const connectionType = determineConnectionType(fromPin.type, toPin.type, fromPinId, toPinId);
  result.type = isSerialPin(fromPin) || isSerialPin(toPin) ? 'serial' : connectionType;

  // 电源连接规则
  if (fromPin.type === 'power' || toPin.type === 'power') {
    if (fromPin.type === 'power' && toPin.type === 'power') {
      result.valid = true;
      result.type = 'power';
    } else if (fromPin.type === 'power' && toPin.type !== 'power' && toPin.type !== 'ground') {
      result.warnings.push('电源引脚应连接到VCC/3V引脚');
    } else if (toPin.type === 'power' && fromPin.type !== 'power' && fromPin.type !== 'ground') {
      result.warnings.push('电源引脚应连接到VCC/3V引脚');
    }
  }

  // 接地连接规则
  if (fromPin.type === 'ground' || toPin.type === 'ground') {
    if (fromPin.type === 'ground' && toPin.type === 'ground') {
      result.valid = true;
      result.type = 'ground';
    } else if ((fromPin.type === 'ground' && toPin.type !== 'ground') ||
               (toPin.type === 'ground' && fromPin.type !== 'ground')) {
      if (fromPin.type !== 'ground' && fromPin.type !== 'power' &&
          toPin.type !== 'ground' && toPin.type !== 'power') {
        result.warnings.push('GND引脚应连接到GND引脚');
      }
    }
  }

  const isTxPin = (pin: Pin) =>
    pin.type === 'serial_tx' || pin.id === 'tx' || pin.id === EXPANSION_SERIAL_TX_PIN;
  const isRxPin = (pin: Pin) =>
    pin.type === 'serial_rx' || pin.id === 'rx' || pin.id === EXPANSION_SERIAL_RX_PIN;

  // IoT 通信连接规则
  if (isSerialPin(fromPin) || isSerialPin(toPin)) {
    result.type = 'serial';
    
    if (isTxPin(fromPin) && !isRxPin(toPin)) {
      result.valid = false;
      result.errors.push('IoT 通信引脚连接不匹配');
    } else if (isRxPin(fromPin) && !isTxPin(toPin)) {
      result.valid = false;
      result.errors.push('IoT 通信引脚连接不匹配');
    } else if (isTxPin(toPin) && !isRxPin(fromPin)) {
      result.valid = false;
      result.errors.push('IoT 通信引脚连接不匹配');
    } else if (isRxPin(toPin) && !isTxPin(fromPin)) {
      result.valid = false;
      result.errors.push('IoT 通信引脚连接不匹配');
    }
  }

  // USB连接规则
  if (fromPin.type === 'usb' || toPin.type === 'usb') {
    if (fromPin.type === 'usb' && toPin.type === 'usb') {
      result.valid = true;
      result.type = 'data';
    } else if ((fromPin.type === 'usb' || toPin.type === 'usb') &&
               (fromPin.type !== 'usb' && toPin.type !== 'usb')) {
      result.warnings.push('USB接口通常连接到另一个USB接口');
    }
  }

  // WIFI无线连接规则 - IOT模块的WIFI引脚连接到路由器的WIFI引脚
  if (fromPin.id === 'wifi' || toPin.id === 'wifi') {
    if (fromPin.id === 'wifi' && toPin.id === 'wifi') {
      result.valid = true;
      result.type = 'wireless';
    } else {
      result.warnings.push('WIFI引脚应连接到另一个WIFI引脚');
    }
  }

  return result;
}

// 确定连接类型
function determineConnectionType(fromType: string, toType: string, fromId?: string, toId?: string): 'power' | 'ground' | 'data' | 'serial' | 'wireless' {
  // WIFI引脚之间的连接是无线类型
  if (fromId === 'wifi' && toId === 'wifi') return 'wireless';
  if (fromType === 'power' || toType === 'power') return 'power';
  if (fromType === 'ground' || toType === 'ground') return 'ground';
  if (
    fromId === 'tx' ||
    fromId === 'rx' ||
    toId === 'tx' ||
    toId === 'rx' ||
    fromId === EXPANSION_SERIAL_TX_PIN ||
    fromId === EXPANSION_SERIAL_RX_PIN ||
    toId === EXPANSION_SERIAL_TX_PIN ||
    toId === EXPANSION_SERIAL_RX_PIN
  ) {
    return 'serial';
  }
  if (fromType === 'serial_tx' || fromType === 'serial_rx' ||
      toType === 'serial_tx' || toType === 'serial_rx') return 'serial';
  return 'data';
}

// 默认即通电的组件（独立供电，不需要外接 VCC/GND）
// 路由器、Web服务器、PC、浏览器、手机均按通电视作可用
const SELF_POWERED_DEFINITION_IDS = new Set([
  'router',
  'web-server',
  'pc-computer',
  'browser',
  'mobile-client',
]);

// 智能终端的内部板卡自身即视为通电（micro:bit、扩展板）
const MAINBOARD_DEFINITION_IDS = new Set(
  componentDefinitions
    .filter((d) => d.category === 'mainboard')
    .map((d) => d.id)
);

// 判断刚拖入画布时组件是否应被视为已通电
// 主板与自带电源的设备返回 true；其余组件需要在画布上完成连线后由 validateSystem 重新计算
export function isInitiallyPowered(definitionId: string): boolean {
  return (
    MAINBOARD_DEFINITION_IDS.has(definitionId) ||
    SELF_POWERED_DEFINITION_IDS.has(definitionId)
  );
}

// 验证整个系统连接
export function validateSystem(
  placedComponents: PlacedComponent[],
  connections: Connection[]
): { issues: string[]; warnings: string[]; powerStatus: Map<string, boolean> } {
  const issues: string[] = [];
  const warnings: string[] = [];
  const powerStatus = new Map<string, boolean>();

  // 初始化所有组件为未供电
  placedComponents.forEach(c => powerStatus.set(c.instanceId, false));

  // 找到电源源（扩展板的3V、micro:bit的3V等）
  const powerSources = placedComponents.filter(c => {
    const def = componentDefinitions.find(d => d.id === c.definitionId);
    return def?.category === 'mainboard';
  });

  // 标记主板为已供电
  powerSources.forEach(c => powerStatus.set(c.instanceId, true));

  // 标记自带电源的设备（路由器、Web服务器、PC、浏览器、手机）
  placedComponents.forEach(component => {
    if (SELF_POWERED_DEFINITION_IDS.has(component.definitionId)) {
      powerStatus.set(component.instanceId, true);
    }
  });

  // 数据库：连接到 Web 服务器即视为通电
  const webServerInstanceIds = new Set(
    placedComponents
      .filter((c) => c.definitionId === 'web-server')
      .map((c) => c.instanceId)
  );
  placedComponents
    .filter((c) => c.definitionId === 'database')
    .forEach((database) => {
      const connectedToWebServer = connections.some((conn) => {
        if (conn.fromComponent === database.instanceId) {
          return webServerInstanceIds.has(conn.toComponent);
        }
        if (conn.toComponent === database.instanceId) {
          return webServerInstanceIds.has(conn.fromComponent);
        }
        return false;
      });
      if (connectedToWebServer) {
        powerStatus.set(database.instanceId, true);
      }
    });

  // 检查传感器/执行器/网络设备是否有电源和接地连接
  placedComponents.forEach(component => {
    const def = componentDefinitions.find(d => d.id === component.definitionId);
    if (!def || def.category === 'mainboard' || def.category === 'server') return;
    // 自带电源的网络设备（如路由器）已在上方标记，跳过 VCC/GND 检查
    if (SELF_POWERED_DEFINITION_IDS.has(component.definitionId)) return;

    const componentConnections = connections.filter(
      c => c.fromComponent === component.instanceId || c.toComponent === component.instanceId
    );

    // 检查VCC连接 - 确保是当前组件的power引脚被连接
    const hasPowerPin = def.pins.some(p => p.type === 'power');
    if (hasPowerPin) {
      const hasPowerConnection = componentConnections.some(conn => {
        // 确定当前组件在连接中的角色
        const isFrom = conn.fromComponent === component.instanceId;
        const componentPinId = isFrom ? conn.fromPin : conn.toPin;
        const otherPinId = isFrom ? conn.toPin : conn.fromPin;
        const otherComponentId = isFrom ? conn.toComponent : conn.fromComponent;
        
        // 检查当前组件的引脚是否是power类型
        const componentPin = def.pins.find(p => p.id === componentPinId);
        if (componentPin?.type === 'power') {
          // 检查另一端是否也是power类型（扩展板的3V等）
          const otherComponent = placedComponents.find(c => c.instanceId === otherComponentId);
          if (otherComponent) {
            const otherDef = componentDefinitions.find(d => d.id === otherComponent.definitionId);
            const otherPin = otherDef?.pins.find(p => p.id === otherPinId);
            return otherPin?.type === 'power';
          }
        }
        return false;
      });
      
      if (!hasPowerConnection) {
        issues.push(`${def.name} 未连接电源(VCC/3V)`);
      } else {
        powerStatus.set(component.instanceId, true);
      }
    }

    // 检查GND连接 - 确保是当前组件的ground引脚被连接
    const hasGroundPin = def.pins.some(p => p.type === 'ground');
    if (hasGroundPin) {
      const hasGroundConnection = componentConnections.some(conn => {
        // 确定当前组件在连接中的角色
        const isFrom = conn.fromComponent === component.instanceId;
        const componentPinId = isFrom ? conn.fromPin : conn.toPin;
        const otherPinId = isFrom ? conn.toPin : conn.fromPin;
        const otherComponentId = isFrom ? conn.toComponent : conn.fromComponent;
        
        // 检查当前组件的引脚是否是ground类型
        const componentPin = def.pins.find(p => p.id === componentPinId);
        if (componentPin?.type === 'ground') {
          // 检查另一端是否也是ground类型
          const otherComponent = placedComponents.find(c => c.instanceId === otherComponentId);
          if (otherComponent) {
            const otherDef = componentDefinitions.find(d => d.id === otherComponent.definitionId);
            const otherPin = otherDef?.pins.find(p => p.id === otherPinId);
            return otherPin?.type === 'ground';
          }
        }
        return false;
      });
      
      if (!hasGroundConnection) {
        issues.push(`${def.name} 未连接接地(GND)`);
      }
    }
  });

  // 检查 IOT 模块与智能终端的通信连接
  const iotComponents = placedComponents.filter(
    c => c.definitionId === 'iot-module' || c.definitionId === 'obloq'
  );
  iotComponents.forEach(iot => {
    const hasMatchedSerialConnection = (
      iotPinId: 'tx' | 'rx',
      expectedExpansionPinId: string
    ) =>
      connections.some((conn) => {
        const iotOnFromSide = conn.fromComponent === iot.instanceId && conn.fromPin === iotPinId;
        const iotOnToSide = conn.toComponent === iot.instanceId && conn.toPin === iotPinId;

        if (!iotOnFromSide && !iotOnToSide) {
          return false;
        }

        const otherComponentId = iotOnFromSide ? conn.toComponent : conn.fromComponent;
        const otherPinId = iotOnFromSide ? conn.toPin : conn.fromPin;
        const otherComponent = placedComponents.find(c => c.instanceId === otherComponentId);

        return otherComponent?.definitionId === 'expansion-board' && otherPinId === expectedExpansionPinId;
      });

    const hasTxConnection = hasMatchedSerialConnection('tx', EXPANSION_SERIAL_RX_PIN);
    const hasRxConnection = hasMatchedSerialConnection('rx', EXPANSION_SERIAL_TX_PIN);

    if (!hasTxConnection) {
      issues.push('IOT模块与智能终端的通信连接不完整');
    }
    if (!hasRxConnection) {
      issues.push('IOT模块与智能终端的通信连接不完整');
    }
  });

  return { issues, warnings, powerStatus };
}

// 获取连接的颜色 - 基于有效性
export function getConnectionColor(valid: boolean): string {
  if (valid) {
    return '#22c55e'; // 绿色 - 正确连接
  } else {
    return '#ef4444'; // 红色 - 错误连接
  }
}

// 获取连接的颜色（按类型） - 用于引脚颜色说明等
export function getConnectionColorByType(type: 'power' | 'ground' | 'data' | 'serial' | 'wireless'): string {
  switch (type) {
    case 'power': return '#ef4444'; // 红色
    case 'ground': return '#1f2937'; // 黑色
    case 'serial': return '#22c55e'; // 绿色
    case 'wireless': return '#8b5cf6'; // 紫色 - 无线连接
    default: return '#3b82f6'; // 蓝色
  }
}

// 连接验证器 - 阶段二核心功能
import { Connection, PlacedComponent, Pin } from '@/types/simulator';
import { componentDefinitions } from '@/data/componentDefinitions';

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
    result.warnings.push(`${fromPin.name} 引脚已有连接`);
  }
  if (toPinConnected) {
    result.warnings.push(`${toPin.name} 引脚已有连接`);
  }

  // 确定连接类型并验证
  const connectionType = determineConnectionType(fromPin.type, toPin.type, fromPinId, toPinId);
  result.type = connectionType;

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

  // 串口连接规则 - TX必须连RX
  if (fromPin.type === 'serial_tx' || toPin.type === 'serial_tx' ||
      fromPin.type === 'serial_rx' || toPin.type === 'serial_rx') {
    result.type = 'serial';
    
    if (fromPin.type === 'serial_tx' && toPin.type !== 'serial_rx') {
      result.valid = false;
      result.errors.push('TX引脚必须连接到RX引脚');
    } else if (fromPin.type === 'serial_rx' && toPin.type !== 'serial_tx') {
      result.valid = false;
      result.errors.push('RX引脚必须连接到TX引脚');
    } else if (toPin.type === 'serial_tx' && fromPin.type !== 'serial_rx') {
      result.valid = false;
      result.errors.push('TX引脚必须连接到RX引脚');
    } else if (toPin.type === 'serial_rx' && fromPin.type !== 'serial_tx') {
      result.valid = false;
      result.errors.push('RX引脚必须连接到TX引脚');
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

  // WIFI无线连接规则 - OBLOQ的WIFI引脚连接到路由器的WIFI引脚
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
  if (fromType === 'serial_tx' || fromType === 'serial_rx' ||
      toType === 'serial_tx' || toType === 'serial_rx') return 'serial';
  return 'data';
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

  // 检查传感器/执行器/网络设备是否有电源和接地连接
  placedComponents.forEach(component => {
    const def = componentDefinitions.find(d => d.id === component.definitionId);
    if (!def || def.category === 'mainboard' || def.category === 'server') return;

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

  // 检查IoT模块的TX/RX连接
  const iotComponents = placedComponents.filter(c => c.definitionId === 'iot-module');
  iotComponents.forEach(iot => {
    const iotConnections = connections.filter(
      c => c.fromComponent === iot.instanceId || c.toComponent === iot.instanceId
    );
    
    const hasTxConnection = iotConnections.some(conn => {
      const pin = conn.fromComponent === iot.instanceId ? conn.fromPin : conn.toPin;
      return pin === 'tx';
    });
    
    const hasRxConnection = iotConnections.some(conn => {
      const pin = conn.fromComponent === iot.instanceId ? conn.fromPin : conn.toPin;
      return pin === 'rx';
    });

    if (!hasTxConnection) {
      issues.push('IoT模块的TX引脚未连接到扩展板的RX');
    }
    if (!hasRxConnection) {
      issues.push('IoT模块的RX引脚未连接到扩展板的TX');
    }
  });

  return { issues, warnings, powerStatus };
}

// 获取连接的颜色
export function getConnectionColor(type: 'power' | 'ground' | 'data' | 'serial' | 'wireless'): string {
  switch (type) {
    case 'power': return '#ef4444'; // 红色
    case 'ground': return '#1f2937'; // 黑色
    case 'serial': return '#22c55e'; // 绿色
    case 'wireless': return '#8b5cf6'; // 紫色 - 无线连接
    default: return '#3b82f6'; // 蓝色
  }
}

import { Scenario } from '@/types/simulator';
import {
  classroomDatabase,
  classroomFlaskCode,
  classroomRouterConfig,
  classroomServerConfig,
  classroomStarterMicrobitCode,
} from './classroomLesson';

const classroomCoreComponents: Scenario['components'] = [
  { instanceId: 'microbit-1', definitionId: 'microbit', position: { x: 310, y: 85 }, state: { powered: true, active: false } },
  { instanceId: 'expansion-1', definitionId: 'expansion-board', position: { x: 250, y: 260 }, state: { powered: true, active: false } },
  { instanceId: 'iot-1', definitionId: 'iot-module', position: { x: 635, y: 325 }, state: { powered: true, active: false } },
  { instanceId: 'router-1', definitionId: 'router', position: { x: 800, y: 325 }, state: { powered: true, active: true } },
  { instanceId: 'server-1', definitionId: 'web-server', position: { x: 965, y: 315 }, state: { powered: true, active: true } },
  { instanceId: 'database-1', definitionId: 'database', position: { x: 985, y: 505 }, state: { powered: true, active: true } },
];

const classroomHardwareChallengeComponents: Scenario['components'] = [
  { instanceId: 'temp-sensor-1', definitionId: 'temp-humidity-sensor', position: { x: 95, y: 500 }, state: { powered: true, active: false, value: 25 } },
  { instanceId: 'buzzer-1', definitionId: 'buzzer', position: { x: 360, y: 510 }, state: { powered: true, active: false } },
];

const classroomCoreConnections: Scenario['connections'] = [
  { id: 'conn-mb-p0', fromComponent: 'microbit-1', fromPin: 'p0', toComponent: 'expansion-1', toPin: 'slot-p0', type: 'data', valid: true },
  { id: 'conn-mb-p1', fromComponent: 'microbit-1', fromPin: 'p1', toComponent: 'expansion-1', toPin: 'slot-p1', type: 'data', valid: true },
  { id: 'conn-mb-p2', fromComponent: 'microbit-1', fromPin: 'p2', toComponent: 'expansion-1', toPin: 'slot-p2', type: 'data', valid: true },
  { id: 'conn-mb-3v', fromComponent: 'microbit-1', fromPin: '3v', toComponent: 'expansion-1', toPin: 'slot-3v', type: 'power', valid: true },
  { id: 'conn-mb-gnd', fromComponent: 'microbit-1', fromPin: 'gnd', toComponent: 'expansion-1', toPin: 'slot-gnd', type: 'ground', valid: true },

  { id: 'conn-iot-vcc', fromComponent: 'iot-1', fromPin: 'vcc', toComponent: 'expansion-1', toPin: '3v-out2', type: 'power', valid: true },
  { id: 'conn-iot-gnd', fromComponent: 'iot-1', fromPin: 'gnd', toComponent: 'expansion-1', toPin: 'gnd-out2', type: 'ground', valid: true },
  { id: 'conn-iot-tx', fromComponent: 'iot-1', fromPin: 'tx', toComponent: 'expansion-1', toPin: 'p15', type: 'serial', valid: true },
  { id: 'conn-iot-rx', fromComponent: 'iot-1', fromPin: 'rx', toComponent: 'expansion-1', toPin: 'p16', type: 'serial', valid: true },
  { id: 'conn-iot-wifi', fromComponent: 'iot-1', fromPin: 'wifi', toComponent: 'router-1', toPin: 'wifi', type: 'wireless', valid: true },

  { id: 'conn-router-server', fromComponent: 'router-1', fromPin: 'lan', toComponent: 'server-1', toPin: 'network', type: 'data', valid: true },
  { id: 'conn-server-db', fromComponent: 'server-1', fromPin: 'db', toComponent: 'database-1', toPin: 'connection', type: 'data', valid: true },
];

const classroomHardwareChallengeConnections: Scenario['connections'] = [
  { id: 'conn-temp-vcc', fromComponent: 'temp-sensor-1', fromPin: 'vcc', toComponent: 'expansion-1', toPin: '3v-out1', type: 'power', valid: true },
  { id: 'conn-temp-gnd', fromComponent: 'temp-sensor-1', fromPin: 'gnd', toComponent: 'expansion-1', toPin: 'gnd-out1', type: 'ground', valid: true },
  { id: 'conn-temp-data', fromComponent: 'temp-sensor-1', fromPin: 'data', toComponent: 'expansion-1', toPin: 'p1', type: 'data', valid: true },

  { id: 'conn-buzzer-vcc', fromComponent: 'buzzer-1', fromPin: 'vcc', toComponent: 'expansion-1', toPin: '3v-out3', type: 'power', valid: true },
  { id: 'conn-buzzer-gnd', fromComponent: 'buzzer-1', fromPin: 'gnd', toComponent: 'expansion-1', toPin: 'gnd-out3', type: 'ground', valid: true },
  { id: 'conn-buzzer-io', fromComponent: 'buzzer-1', fromPin: 'io', toComponent: 'expansion-1', toPin: 'p2', type: 'data', valid: true },
];

export const classroomTemperatureScenario: Scenario = {
  id: 'classroom-temperature',
  name: '食堂温度监测与预警系统课堂版',
  description: '学生从半成品硬件链路开始，选择温湿度传感器和蜂鸣器，完成模块功能匹配，观察 P1/P2 引脚连接后再运行排错。',
  components: classroomCoreComponents,
  connections: classroomCoreConnections,
  microbitCode: classroomStarterMicrobitCode,
  flaskCode: classroomFlaskCode,
  database: classroomDatabase,
  routerConfig: classroomRouterConfig,
  serverConfig: classroomServerConfig,
};

export const classroomTemperatureDemoScenario: Scenario = {
  id: 'classroom-temperature-demo',
  name: '食堂温度监测与预警系统完整演示',
  description: '教师投屏演示用：硬件链路完整，代码仍保留两处引脚排错点，适合讲解数据流与故障排查。',
  components: [...classroomCoreComponents, ...classroomHardwareChallengeComponents],
  connections: [...classroomCoreConnections, ...classroomHardwareChallengeConnections],
  microbitCode: classroomStarterMicrobitCode,
  flaskCode: classroomFlaskCode,
  database: classroomDatabase,
  routerConfig: {
    ...classroomRouterConfig,
    connectedDevices: ['IoT-001', 'Flask-Server'],
  },
  serverConfig: classroomServerConfig,
};

export const smartIrrigationScenario: Scenario = {
  id: 'smart-irrigation',
  name: '智能灌溉系统',
  description: '备用场景：检测土壤湿度并通过继电器控制灌溉。',
  components: [
    { instanceId: 'microbit-1', definitionId: 'microbit', position: { x: 60, y: 20 }, state: { powered: true, active: false } },
    { instanceId: 'expansion-1', definitionId: 'expansion-board', position: { x: 60, y: 180 }, state: { powered: true, active: false } },
    { instanceId: 'temp-sensor-1', definitionId: 'temp-humidity-sensor', position: { x: 60, y: 420 }, state: { powered: true, active: false, value: 40 } },
    { instanceId: 'relay-1', definitionId: 'relay', position: { x: 180, y: 420 }, state: { powered: true, active: false } },
    { instanceId: 'pc-1', definitionId: 'pc-computer', position: { x: 420, y: 160 }, state: { powered: true, active: true } },
  ],
  connections: [
    { id: 'conn-usb', fromComponent: 'microbit-1', fromPin: 'usb', toComponent: 'pc-1', toPin: 'usb', type: 'data', valid: true },
    { id: 'conn-mb-3v', fromComponent: 'microbit-1', fromPin: '3v', toComponent: 'expansion-1', toPin: 'slot-3v', type: 'power', valid: true },
    { id: 'conn-mb-gnd', fromComponent: 'microbit-1', fromPin: 'gnd', toComponent: 'expansion-1', toPin: 'slot-gnd', type: 'ground', valid: true },
    { id: 'conn-mb-p0', fromComponent: 'microbit-1', fromPin: 'p0', toComponent: 'expansion-1', toPin: 'slot-p0', type: 'data', valid: true },
    { id: 'conn-temp-vcc', fromComponent: 'temp-sensor-1', fromPin: 'vcc', toComponent: 'expansion-1', toPin: '3v-out1', type: 'power', valid: true },
    { id: 'conn-temp-gnd', fromComponent: 'temp-sensor-1', fromPin: 'gnd', toComponent: 'expansion-1', toPin: 'gnd-out1', type: 'ground', valid: true },
    { id: 'conn-temp-data', fromComponent: 'temp-sensor-1', fromPin: 'data', toComponent: 'expansion-1', toPin: 'p0', type: 'data', valid: true },
    { id: 'conn-relay-vcc', fromComponent: 'relay-1', fromPin: 'vcc', toComponent: 'expansion-1', toPin: '3v-out2', type: 'power', valid: true },
    { id: 'conn-relay-gnd', fromComponent: 'relay-1', fromPin: 'gnd', toComponent: 'expansion-1', toPin: 'gnd-out2', type: 'ground', valid: true },
    { id: 'conn-relay-in', fromComponent: 'relay-1', fromPin: 'in', toComponent: 'expansion-1', toPin: 'p3', type: 'data', valid: true },
  ],
  microbitCode: `from microbit import *

THRESHOLD = 30

while True:
    humidity = pin0.read_analog() / 10
    display.scroll(str(int(humidity)))
    pin3.write_digital(1 if humidity < THRESHOLD else 0)
    sleep(2000)
`,
  flaskCode: '',
  database: { tables: [], records: {} },
  routerConfig: { ssid: '', password: '', ip: '', connectedDevices: [] },
  serverConfig: { ip: '', port: 5000, running: false, routes: [], logs: [] },
};

export const scenarios: Scenario[] = [
  classroomTemperatureScenario,
  classroomTemperatureDemoScenario,
  smartIrrigationScenario,
];

export function loadScenario(scenarioId: string) {
  return scenarios.find((scenario) => scenario.id === scenarioId);
}

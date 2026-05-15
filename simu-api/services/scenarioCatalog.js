const scenarioCatalog = [
  {
    id: 'classroom-temperature',
    name: '教室温度检测系统课堂版',
    description: '补全用户端设备，修正传感器和执行器引脚代码，验证 POST 上传、GET 查询和数据库记录。',
    requiredComponents: [
      'microbit',
      'expansion-board',
      'temp-humidity-sensor',
      'buzzer',
      'iot-module',
      'router',
      'web-server',
      'database',
      'pc-computer',
      'browser',
      'mobile-client',
    ],
    requiredConnections: [
      ['microbit', 'usb', 'pc-computer', 'usb'],
      ['microbit', 'p1', 'expansion-board', 'slot-p1'],
      ['microbit', 'p2', 'expansion-board', 'slot-p2'],
      ['microbit', '3v', 'expansion-board', 'slot-3v'],
      ['microbit', 'gnd', 'expansion-board', 'slot-gnd'],
      ['temp-humidity-sensor', 'vcc', 'expansion-board', '3v-out1'],
      ['temp-humidity-sensor', 'gnd', 'expansion-board', 'gnd-out1'],
      ['temp-humidity-sensor', 'data', 'expansion-board', 'p1'],
      ['buzzer', 'vcc', 'expansion-board', '3v-out3'],
      ['buzzer', 'gnd', 'expansion-board', 'gnd-out3'],
      ['buzzer', 'io', 'expansion-board', 'p2'],
      ['iot-module', 'tx', 'expansion-board', 'p15'],
      ['iot-module', 'rx', 'expansion-board', 'p16'],
      ['iot-module', 'wifi', 'router', 'wifi'],
      ['router', 'lan', 'web-server', 'network'],
      ['web-server', 'db', 'database', 'connection'],
      ['browser', 'http', 'router', 'lan'],
      ['mobile-client', 'http', 'router', 'lan'],
    ],
  },
  {
    id: 'smart-irrigation',
    name: '智能灌溉',
    description: '检测土壤状态并通过继电器控制灌溉',
    requiredComponents: ['microbit', 'expansion-board', 'temp-humidity-sensor', 'relay', 'pc-computer'],
    requiredConnections: [
      ['microbit', 'usb', 'pc-computer', 'usb'],
      ['microbit', '3v', 'expansion-board', 'slot-3v'],
      ['microbit', 'gnd', 'expansion-board', 'slot-gnd'],
      ['temp-humidity-sensor', 'data', 'expansion-board', 'p0'],
      ['relay', 'in', 'expansion-board', 'p3'],
    ],
  },
];

function getScenarioById(id) {
  return scenarioCatalog.find((scenario) => scenario.id === id) || null;
}

module.exports = {
  scenarioCatalog,
  getScenarioById,
};

const scenarioCatalog = [
  {
    id: 'classroom-temperature',
    name: '教室温度监测',
    description: '监测教室温度并上传到服务器',
    requiredComponents: ['microbit', 'expansion-board', 'temp-humidity-sensor', 'iot-module', 'router', 'web-server', 'database'],
    requiredConnections: [
      ['microbit', '3v', 'expansion-board', 'slot-3v'],
      ['microbit', 'gnd', 'expansion-board', 'slot-gnd'],
      ['temp-humidity-sensor', 'vcc', 'expansion-board', '3v-out1'],
      ['temp-humidity-sensor', 'gnd', 'expansion-board', 'gnd-out1'],
      ['temp-humidity-sensor', 'data', 'expansion-board', 'p0'],
      ['iot-module', 'tx', 'expansion-board', 'p15'],
      ['iot-module', 'rx', 'expansion-board', 'p16'],
      ['iot-module', 'wifi', 'router', 'wifi'],
      ['router', 'lan', 'web-server', 'network'],
      ['web-server', 'db', 'database', 'connection'],
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

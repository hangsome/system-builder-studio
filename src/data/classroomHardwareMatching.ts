export type HardwareMatchingAnswerMap = Partial<Record<string, string[]>>;

export interface HardwareMatchingModule {
  id: string;
  name: string;
}

export interface HardwareMatchingFunction {
  id: string;
  text: string;
}

export const CLASSROOM_HARDWARE_MATCHING_STORAGE_KEY = 'classroom-hardware-matching-answers-v1';

export const classroomHardwareMatchingModules: HardwareMatchingModule[] = [
  { id: 'sensor', name: '温湿度传感器' },
  { id: 'smart-terminal', name: '智能终端' },
  { id: 'buzzer', name: '蜂鸣器' },
  { id: 'iot', name: 'IoT 模块' },
  { id: 'router', name: 'WiFi 路由器' },
  { id: 'server', name: 'Flask 服务器' },
  { id: 'database', name: 'SQLite 数据库' },
  { id: 'phone', name: '手机' },
];

export const classroomHardwareMatchingFunctions: HardwareMatchingFunction[] = [
  { id: 'onsite-alert', text: '温度超过冷藏阈值时，在现场发出声音提醒' },
  { id: 'history-records', text: '保存实时温度、报警状态和历史记录' },
  { id: 'sense-temperature', text: '自动感知食堂储物间温度变化' },
  { id: 'threshold-judge', text: '判断当前温度是否超过冷藏阈值' },
  { id: 'network-link', text: '提供无线网络，让设备能够互相通信' },
  { id: 'duty-view', text: '值班人员访问服务器页面查看数据' },
  { id: 'process-control', text: '运行程序，读取采集值并控制报警执行器' },
  { id: 'upload-abnormal', text: '把温度或异常信息发送到服务器' },
  { id: 'http-service', text: '接收上传请求，并提供 Web 服务' },
];

export const classroomHardwareMatchingAnswerKey: Record<string, string[]> = {
  sensor: ['sense-temperature'],
  'smart-terminal': ['process-control', 'threshold-judge'],
  buzzer: ['onsite-alert'],
  iot: ['upload-abnormal'],
  router: ['network-link'],
  server: ['http-service', 'threshold-judge'],
  database: ['history-records'],
  phone: ['duty-view'],
};

export function evaluateHardwareMatchingAnswers(answers: HardwareMatchingAnswerMap) {
  const expectedConnections = Object.values(classroomHardwareMatchingAnswerKey).flat();
  const total = expectedConnections.length;
  const correct = classroomHardwareMatchingModules.reduce((sum, item) => {
    const actual = new Set(answers[item.id] || []);
    const expected = classroomHardwareMatchingAnswerKey[item.id] || [];
    return sum + expected.filter((functionId) => actual.has(functionId)).length;
  }, 0);

  return {
    correct,
    total,
    complete: Object.entries(classroomHardwareMatchingAnswerKey).every(([moduleId, functionIds]) => {
      const actual = new Set(answers[moduleId] || []);
      return functionIds.every((functionId) => actual.has(functionId));
    }),
  };
}

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  Cable,
  CheckCircle2,
  ChevronDown,
  Database,
  Eye,
  FileCode2,
  Gauge,
  HardDrive,
  Monitor,
  Network,
  Play,
  Server,
  Smartphone,
  Thermometer,
  UserRound,
  Wifi,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

type HardwareItem = {
  id: string;
  name: string;
  role: string;
  group: '基础硬件' | '网络与服务' | '用户端' | '干扰项';
  icon: typeof Cable;
  required: boolean;
  auto?: string;
};

type QuizState = Record<string, string>;

const hardwareItems: HardwareItem[] = [
  {
    id: 'microbit',
    name: 'micro:bit 主板',
    role: '采集与控制的核心，运行烧录后的程序',
    group: '基础硬件',
    icon: HardDrive,
    required: true,
    auto: '拖入扩展板后，主板与扩展板插槽自动连接',
  },
  {
    id: 'expansion',
    name: '扩展板',
    role: '把 micro:bit 的引脚扩展出来，连接传感器、执行器和 IoT 模块',
    group: '基础硬件',
    icon: Cable,
    required: true,
    auto: 'P0、P1、P2、3V、GND 与 micro:bit 对应引脚自动连接',
  },
  {
    id: 'sensor',
    name: '温湿度传感器',
    role: '读取教室温度，DATA 自动接到扩展板 P1',
    group: '基础硬件',
    icon: Thermometer,
    required: true,
    auto: 'VCC 接 3V，GND 接 GND，DATA 接 P1',
  },
  {
    id: 'buzzer',
    name: '蜂鸣器',
    role: '温度超过阈值时发出报警，IO 自动接到扩展板 P2',
    group: '基础硬件',
    icon: Gauge,
    required: true,
    auto: 'VCC 接 3V，GND 接 GND，IO 接 P2',
  },
  {
    id: 'iot',
    name: 'IoT 模块',
    role: '让 micro:bit 通过 WiFi 访问服务器',
    group: '网络与服务',
    icon: Wifi,
    required: true,
    auto: '与扩展板保持通信连接，并接入电源',
  },
  {
    id: 'router',
    name: 'WiFi 路由器',
    role: '提供无线网络，连接 IoT、服务器、浏览器和手机',
    group: '网络与服务',
    icon: Network,
    required: true,
    auto: '与 IoT 模块形成无线连接',
  },
  {
    id: 'server',
    name: 'Flask 服务器',
    role: '提供上传和查询接口，接收 HTTP 请求',
    group: '网络与服务',
    icon: Server,
    required: true,
    auto: '与路由器自动连接，服务器地址为 192.168.1.100:5000',
  },
  {
    id: 'database',
    name: 'SQLite 数据库',
    role: '保存 sensorlog 表中的温度记录和报警状态',
    group: '网络与服务',
    icon: Database,
    required: true,
    auto: '与 Flask 服务器自动连接',
  },
  {
    id: 'pc',
    name: 'PC 电脑',
    role: '用于编写程序并通过 USB 给 micro:bit 烧录',
    group: '用户端',
    icon: Monitor,
    required: true,
  },
  {
    id: 'browser',
    name: '浏览器',
    role: '访问 Flask 首页，查看实时数据和历史数据',
    group: '用户端',
    icon: Eye,
    required: true,
  },
  {
    id: 'phone',
    name: '手机',
    role: '用户通过手机接入 WiFi 后访问服务器',
    group: '用户端',
    icon: Smartphone,
    required: true,
  },
  {
    id: 'printer',
    name: '打印机',
    role: '可输出纸质报表，但不是本系统实时检测链路的必要组件',
    group: '干扰项',
    icon: FileCode2,
    required: false,
  },
];

const softwareQuestions = [
  {
    id: 'wifi',
    code: 'WIFI_SSID = "School_WiFi"\nSERVER_IP = "192.168.1.100"\nUPLOAD_ROUTE = "/upload"',
    answer: '配置网络和服务器地址',
    explanation:
      'micro:bit 端必须知道 WiFi 名称、服务器 IP、端口和上传路由，才能把采集数据发到 Flask。',
  },
  {
    id: 'read',
    code: 'raw = pin0.read_analog()\ntemp = round(raw / 10, 1)',
    answer: '读取传感器数据',
    explanation:
      '这里暂时使用 pin0。运行排错阶段要核对画布实际 DATA 引脚：可以把代码改到画布引脚，也可以把画布连线调整到代码引脚。',
  },
  {
    id: 'alarm',
    code: 'if temp > TEMP_THRESHOLD:\n    pin3.write_digital(1)\nelse:\n    pin3.write_digital(0)',
    answer: '控制执行器报警',
    explanation:
      '这里暂时使用 pin3。运行排错阶段要核对画布实际 IO 引脚：可以把代码改到画布引脚，也可以把画布连线调整到代码引脚。',
  },
  {
    id: 'upload-get',
    code: 'url = url + "?id=1&val=" + str(temp)\nobloq.http_get(url)',
    answer: 'GET 上传 id 和 val',
    explanation:
      '课堂约定使用 GET 请求上传，传感器编号放在 id 参数中，温度值放在 val 参数中，由 /upload 写入数据库。',
  },
  {
    id: 'get',
    code: "@app.route('/', methods=['GET'])\ndef index():\n    return render_template('index.html', records=rows)",
    answer: 'GET 查询并展示数据',
    explanation:
      '浏览器在地址栏访问服务器首页属于 GET 请求，适合查询已有数据并展示页面。',
  },
];

const softwareOptions = [
  '配置网络和服务器地址',
  '读取传感器数据',
  '控制执行器报警',
  'GET 上传 id 和 val',
  'GET 查询并展示数据',
];

const networkTasks = [
  {
    id: 'sensor-pin',
    title: '问题 1：运行后传感器数据获取不了',
    symptom: '日志显示 raw = 0，浏览器没有新增温度记录。',
    canvas: '画布上温湿度传感器 DATA 自动连接到扩展板 P1。',
    question: '怎样修复才符合“代码与连线对应”？',
    options: ['把 pin0.read_analog() 改为 pin1.read_analog()，或把 DATA 线调整到 P0', '把服务器端口改为 80', '把 id 和 val 参数删除'],
    answer: '把 pin0.read_analog() 改为 pin1.read_analog()，或把 DATA 线调整到 P0',
    explanation:
      '默认画布中传感器物理连接在 P1，程序却从 P0 读数，数据源就不一致。只要最终 DATA 连线和 read_analog 的引脚一致，再重新烧录后，采集环节就能进入上传环节。',
  },
  {
    id: 'actuator-pin',
    title: '问题 2：服务器发送指令后，执行器没有执行',
    symptom: 'Flask 返回 BUZZER_ON，但蜂鸣器没有响。',
    canvas: '画布上蜂鸣器 IO 自动连接到扩展板 P2。',
    question: '怎样修复才符合“代码与连线对应”？',
    options: ['把 pin3.write_digital(...) 改为 pin2.write_digital(...)，或把 IO 线调整到 P3', '把数据库表名 sensorlog 改成 sensorlist', '把 WiFi 密码删除'],
    answer: '把 pin3.write_digital(...) 改为 pin2.write_digital(...)，或把 IO 线调整到 P3',
    explanation:
      '服务器指令已经到达，问题不在 HTTP 或数据库，而在执行器控制引脚。默认蜂鸣器接 P2，代码写 P3，二者不一致；改代码或改连线都可以，但必须对应。',
  },
  {
    id: 'request-method',
    title: 'HTTP 请求方式判断',
    symptom: '一个操作是 micro:bit 上传温度；另一个操作是浏览器查看首页。',
    canvas: 'Flask 提供 GET /upload?id=...&val=... 和 GET / 两个路由。',
    question: '两种操作的 GET 请求有什么区别？',
    options: ['上传访问 /upload 并带 id、val；查看访问首页 /', '上传访问首页 /；查看访问 /upload', '两个都访问 /upload 且不带参数'],
    answer: '上传访问 /upload 并带 id、val；查看访问首页 /',
    explanation:
      '本课把上传也设计成 GET 请求：上传要明确 /upload、id 和 val；浏览器查看首页只需要访问服务器首页 /。',
  },
];

const dataCases = [
  {
    id: 'no-records',
    title: '数据库没有新增记录',
    evidence: ['浏览器页面仍能打开', 'Flask 日志没有 GET /upload?id=...&val=...', 'micro:bit 显示已经读取温度'],
    answer: '网络链路或上传路由故障',
    options: ['数据库字段显示顺序错误', '网络链路或上传路由故障', '浏览器字体太小'],
    explanation:
      '服务器首页能打开说明服务器基本可用；日志没有 GET /upload?id=...&val=...，说明 micro:bit 到 Flask 的上传请求没有到达，优先查 IoT、WiFi、路由器、IP、端口、/upload 以及 id、val 参数。',
  },
  {
    id: 'stale-value',
    title: '数据库一直重复 26.0 摄氏度',
    evidence: ['传感器滑块调到 33 摄氏度', 'sensorlog 仍写入 26.0', '蜂鸣器没有触发'],
    answer: '传感器读取引脚或传感器本身故障',
    options: ['传感器读取引脚或传感器本身故障', '手机没有连接 WiFi', 'SQLite 表名过长'],
    explanation:
      '数据从源头就没有变化，后续数据库和页面只是呈现错误结果。应先核对 DATA 接 P1、代码 pin1、传感器是否被设置为故障。',
  },
  {
    id: 'alarm-missing',
    title: '温度超过阈值但蜂鸣器不响',
    evidence: ['sensorlog 中 value = 32.4', 'alarm = 1', 'Flask 返回 BUZZER_ON'],
    answer: '执行器引脚或执行器组件故障',
    options: ['执行器引脚或执行器组件故障', 'id 或 val 参数错误', '数据库没有初始化'],
    explanation:
      '数据已入库、阈值判断也正确，服务器命令已经返回。故障范围收缩到 micro:bit 控制蜂鸣器的代码引脚、连线或蜂鸣器组件。',
  },
  {
    id: 'page-empty',
    title: '数据库有记录但页面不显示',
    evidence: ['sensorlog 有新增数据', '浏览器访问 / 后表格为空', '服务器没有报错'],
    answer: '查询或页面展示代码故障',
    options: ['温度传感器没有供电', '查询或页面展示代码故障', '蜂鸣器 IO 接错'],
    explanation:
      '数据库已经证明采集、上传和存储完成；页面为空应检查 GET / 的查询语句、模板变量 records、浏览器访问地址等用户呈现环节。',
  },
];

const summaryNodes = [
  ['人', '规划、搭建、使用、维护系统，是信息系统的组织者和使用者。'],
  ['硬件', '传感器、micro:bit、扩展板、IoT、路由器、服务器、数据库、终端。'],
  ['软件', 'micro:bit 采集与控制程序，Flask 接收、存储、查询程序。'],
  ['网络', 'WiFi、HTTP、IP、端口、路由共同保证数据能到达服务器。'],
  ['数据', '温度值、报警状态、时间戳进入 sensorlog，支持观察和排障。'],
];

const codePanel = `# micro:bit 端关键代码，含两个需要运行排查的引脚点
WIFI_SSID = "School_WiFi"
SERVER_IP = "192.168.1.100"
SERVER_PORT = 5000
UPLOAD_ROUTE = "/upload"
TEMP_THRESHOLD = 30

while True:
    # 提示：先看画布上传感器 DATA 实际接在哪个 P 引脚，再检查这里是否一致
    raw = pin0.read_analog()
    temp = round(raw / 10, 1)

    # 提示：先看画布上蜂鸣器 IO 实际接在哪个 P 引脚，再检查这里是否一致
    if temp > TEMP_THRESHOLD:
        pin3.write_digital(1)
    else:
        pin3.write_digital(0)

    # 上传温度记录使用 GET 请求，并同时带 id 和 val 两个参数
    url = "http://" + SERVER_IP + ":" + str(SERVER_PORT) + UPLOAD_ROUTE
    url = url + "?id=1&val=" + str(temp)
    obloq.http_get(url)
    sleep(5000)`;

function isAnswerCorrect<T extends { id: string; answer: string }>(items: T[], answers: QuizState) {
  return items.every((item) => answers[item.id] === item.answer);
}

function Feedback({
  correct,
  explanation,
}: {
  correct: boolean;
  explanation: string;
}) {
  return (
    <div
      className={`mt-3 rounded-md border px-3 py-2 text-sm leading-6 ${
        correct
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-amber-200 bg-amber-50 text-amber-950'
      }`}
    >
      <span className="font-medium">{correct ? '判断正确。' : '还需要回到画布和代码核对。'}</span>
      <span className="ml-1">{explanation}</span>
    </div>
  );
}

export default function LessonFlowPage() {
  const [selectedHardware, setSelectedHardware] = useState<string[]>([]);
  const [draggingHardware, setDraggingHardware] = useState<string | null>(null);
  const [softwareAnswers, setSoftwareAnswers] = useState<QuizState>({});
  const [networkAnswers, setNetworkAnswers] = useState<QuizState>({});
  const [dataAnswers, setDataAnswers] = useState<QuizState>({});
  const [showSoftwareFeedback, setShowSoftwareFeedback] = useState(false);
  const [showNetworkFeedback, setShowNetworkFeedback] = useState(false);
  const [showDataFeedback, setShowDataFeedback] = useState(false);
  const [codeExpanded, setCodeExpanded] = useState(true);

  const hardwareScore = useMemo(() => {
    const required = hardwareItems.filter((item) => item.required);
    const selectedRequired = required.filter((item) => selectedHardware.includes(item.id)).length;
    const selectedWrong = hardwareItems.filter((item) => !item.required && selectedHardware.includes(item.id)).length;
    return { selectedRequired, totalRequired: required.length, selectedWrong };
  }, [selectedHardware]);

  const addHardware = (id: string) => {
    setSelectedHardware((current) => (current.includes(id) ? current : [...current, id]));
  };

  const removeHardware = (id: string) => {
    setSelectedHardware((current) => current.filter((item) => item !== id));
  };

  return (
    <main className="min-h-[100dvh] bg-[#f7f8f5] text-slate-950">
      <section className="border-b border-slate-200 bg-[#e8eee8]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div className="space-y-5">
            <Badge className="w-fit border-slate-300 bg-white text-slate-700 hover:bg-white">
              信息系统知识点复习 · 互动导学案
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                用“教室温度检测系统”走完整个信息系统
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-700">
                教师先用空白画布根据学生回答搭建基础硬件框架；学生再进入半成品画布补充用户端、分析软件、运行排错，最后用导学案梳理五个组成部分。
              </p>
            </div>
          </div>

          <aside className="grid gap-3 rounded-md border border-slate-300 bg-white p-4 shadow-sm">
            {[
              ['课堂问题', '如果学校真的要搭建这个系统，由谁来搭建、使用和维护？'],
              ['活动证据', '观察连线、提交硬件判断、分析 GET 请求参数、试运行后修复代码或连线。'],
              ['核心结论', '信息系统由人、硬件、软件、网络、数据共同构成。'],
            ].map(([label, text]) => (
              <div key={label} className="grid grid-cols-[92px_1fr] gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                <span className="text-sm font-medium text-slate-500">{label}</span>
                <span className="text-sm leading-6 text-slate-800">{text}</span>
              </div>
            ))}
          </aside>
        </div>
      </section>

      <Tabs defaultValue="intro" className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 md:grid-cols-6">
          {[
            ['intro', '情境导入'],
            ['hardware', '硬件'],
            ['software', '软件'],
            ['network', '网络'],
            ['data', '数据'],
            ['summary', '知识梳理'],
          ].map(([value, label]) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-11 rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm data-[state=active]:border-slate-950 data-[state=active]:bg-slate-950 data-[state=active]:text-white"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="intro" className="mt-5">
          <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <UserRound className="h-5 w-5 text-slate-700" />
                <h2 className="text-2xl font-semibold tracking-tight">情景导入</h2>
              </div>
              <div className="mt-5 space-y-4 text-sm leading-7 text-slate-700">
                <p>
                  教材中的“教室温度检测系统”可以实时采集温度，温度过高时报警，并把记录保存到服务器数据库中。
                </p>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="font-medium text-slate-950">问题思考</p>
                  <p className="mt-2">如果今天真的要在学校搭建这个系统，只准备传感器、主板、服务器和数据库够不够？还缺少谁？</p>
                </div>
                <p>
                  引导结论：系统不会自己规划、连接、编程、维护和使用。用户、教师、学生、管理员这些“人”也是信息系统的重要组成部分。
                </p>
              </div>
            </article>

            <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">五个组成部分初识</h3>
              <div className="mt-4 grid gap-3">
                {summaryNodes.map(([title, text]) => (
                  <div key={title} className="grid grid-cols-[72px_1fr] gap-3 rounded-md border border-slate-200 bg-[#fbfcf8] p-3">
                    <span className="rounded-md bg-slate-950 px-3 py-2 text-center text-sm font-medium text-white">{title}</span>
                    <p className="text-sm leading-6 text-slate-700">{text}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </TabsContent>

        <TabsContent value="hardware" className="mt-5">
          <section className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
            <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">选择并拖入硬件</h2>
                  <p className="mt-1 text-sm text-slate-600">把你认为需要的组件拖到右侧系统硬件框，也可以直接点击加入。</p>
                </div>
                <Badge className="bg-slate-950 text-white hover:bg-slate-950">
                  {hardwareScore.selectedRequired}/{hardwareScore.totalRequired}
                </Badge>
              </div>
              <div className="mt-5 grid gap-3">
                {hardwareItems.map((item) => {
                  const Icon = item.icon;
                  const selected = selectedHardware.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      draggable
                      onDragStart={() => setDraggingHardware(item.id)}
                      onDragEnd={() => setDraggingHardware(null)}
                      onClick={() => addHardware(item.id)}
                      className={`grid w-full grid-cols-[36px_1fr_auto] items-center gap-3 rounded-md border p-3 text-left transition hover:-translate-y-0.5 ${
                        selected ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-[#fbfcf8] text-slate-900 hover:border-slate-400'
                      }`}
                    >
                      <span className={`flex h-9 w-9 items-center justify-center rounded-md ${selected ? 'bg-white/10' : 'bg-white'}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-medium">{item.name}</span>
                        <span className={`mt-1 block text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}>{item.group}</span>
                      </span>
                      {selected ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4 text-slate-400" />}
                    </button>
                  );
                })}
              </div>
            </article>

            <article
              className="rounded-md border border-dashed border-slate-400 bg-white p-5 shadow-sm"
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggingHardware) addHardware(draggingHardware);
                setDraggingHardware(null);
              }}
            >
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <h3 className="text-xl font-semibold">系统硬件框</h3>
                  <p className="mt-1 text-sm text-slate-600">目标链路：采集、处理、传输、服务、存储、呈现。</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedHardware([])}>
                  清空
                </Button>
              </div>

              <div className="mt-5 min-h-[280px] rounded-md border border-slate-200 bg-[#f7f8f5] p-4">
                {selectedHardware.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center text-sm text-slate-500">
                    将左侧组件拖入这里
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {selectedHardware.map((id) => {
                      const item = hardwareItems.find((candidate) => candidate.id === id);
                      if (!item) return null;
                      const Icon = item.icon;
                      return (
                        <div key={id} className="rounded-md border border-slate-200 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex gap-3">
                              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100">
                                <Icon className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="text-sm font-medium">{item.name}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-600">{item.role}</p>
                              </div>
                            </div>
                            <button type="button" onClick={() => removeHardware(id)} className="text-slate-400 hover:text-slate-900">
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                          {item.auto ? (
                            <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900">
                              自动连接：{item.auto}
                            </p>
                          ) : (
                            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
                              需要学生或教师手动说明连接关系。
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6">
                <p className="font-medium text-slate-950">解析</p>
                <p className="mt-2 text-slate-700">
                  教师演示时可以先从空白画布拖入基础硬件：micro:bit、扩展板、传感器、蜂鸣器、IoT 模块、路由器、服务器和数据库会形成主链路。学生版半成品保留 PC、浏览器和手机由学生补充：PC 通过 USB 给 micro:bit 烧录程序；浏览器和手机通过 WiFi 访问服务器查看数据。
                </p>
                {hardwareScore.selectedWrong > 0 ? (
                  <p className="mt-2 text-amber-800">你选入了非必要组件。它可以扩展系统功能，但不是本节课“实时温度检测链路”的必需硬件。</p>
                ) : null}
              </div>
            </article>
          </section>
        </TabsContent>

        <TabsContent value="software" className="mt-5">
          <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
            <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">软件：选择代码注释</h2>
                  <p className="mt-1 text-sm text-slate-600">给每段代码选择最合适的说明，再看解析。</p>
                </div>
                <Button onClick={() => setShowSoftwareFeedback(true)}>查看解析</Button>
              </div>

              <div className="mt-5 grid gap-4">
                {softwareQuestions.map((question) => {
                  const selected = softwareAnswers[question.id];
                  return (
                    <div key={question.id} className="rounded-md border border-slate-200 bg-[#fbfcf8] p-4">
                      <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                        <code>{question.code}</code>
                      </pre>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {softwareOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setSoftwareAnswers((current) => ({ ...current, [question.id]: option }))}
                            className={`rounded-md border px-3 py-2 text-xs transition ${
                              selected === option
                                ? 'border-slate-950 bg-slate-950 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      {showSoftwareFeedback ? (
                        <Feedback correct={selected === question.answer} explanation={question.explanation} />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </article>

            <aside className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">知识梳理</h3>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <p>软件部分一般分为 micro:bit 端和 Flask 服务端。</p>
                <p className="rounded-md bg-slate-50 p-3">
                  micro:bit 端：配置 WiFi、服务器 IP、端口、上传路由，读取传感器数据，控制蜂鸣器，并通过 GET 请求上传 id 和 val。
                </p>
                <p className="rounded-md bg-slate-50 p-3">
                  Flask 端：提供 GET /upload?id=...&val=... 接收数据、写入 SQLite；提供 GET / 供浏览器或手机查看数据。
                </p>
                <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                  当前匹配结果：{isAnswerCorrect(softwareQuestions, softwareAnswers) ? '全部正确' : '还有代码段需要重新判断'}
                </p>
              </div>
            </aside>
          </section>
        </TabsContent>

        <TabsContent value="network" className="mt-5">
          <section className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
            <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">网络：排查代码与连接</h2>
                  <p className="mt-1 text-sm text-slate-600">先根据现象选择修改方案，再查看详细解析。</p>
                </div>
                <Button onClick={() => setShowNetworkFeedback(true)}>提交判断</Button>
              </div>

              <div className="mt-5 grid gap-4">
                {networkTasks.map((task) => {
                  const selected = networkAnswers[task.id];
                  return (
                    <div key={task.id} className="rounded-md border border-slate-200 bg-[#fbfcf8] p-4">
                      <h3 className="font-semibold">{task.title}</h3>
                      <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                        <p>运行现象：{task.symptom}</p>
                        <p>画布证据：{task.canvas}</p>
                        <p className="font-medium text-slate-950">{task.question}</p>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {task.options.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setNetworkAnswers((current) => ({ ...current, [task.id]: option }))}
                            className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                              selected === option
                                ? 'border-slate-950 bg-slate-950 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      {showNetworkFeedback ? (
                        <Feedback correct={selected === task.answer} explanation={task.explanation} />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </article>

            <aside className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <Collapsible open={codeExpanded} onOpenChange={setCodeExpanded}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">可放大的代码栏</h3>
                    <p className="mt-1 text-sm text-slate-600">适合投屏，让学生直接在代码中寻找引脚问题。</p>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm">
                      {codeExpanded ? '收起' : '展开'}
                      <ChevronDown className={`ml-2 h-4 w-4 transition ${codeExpanded ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <pre className="mt-4 max-h-[620px] overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                    <code>{codePanel}</code>
                  </pre>
                </CollapsibleContent>
              </Collapsible>

              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <p className="font-medium text-slate-950">网络环节知识点</p>
                <p className="mt-2">
                  HTTP 请求需要明确服务器 IP、端口、路由和参数。数据上传走 GET /upload?id=...&val=...，页面查询走 GET /。如果日志、数据库和画布现象不一致，要沿着“传感器、主板、IoT、路由器、服务器、数据库、用户端”的顺序定位断点。
                </p>
              </div>
            </aside>
          </section>
        </TabsContent>

        <TabsContent value="data" className="mt-5">
          <section className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
            <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">数据：从异常反查故障</h2>
                  <p className="mt-1 text-sm text-slate-600">观察数据库和运行现象，选择最可能的故障点。</p>
                </div>
                <Button onClick={() => setShowDataFeedback(true)}>查看排障解析</Button>
              </div>

              <div className="mt-5 overflow-hidden rounded-md border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr>
                      <th className="px-3 py-2 font-medium">id</th>
                      <th className="px-3 py-2 font-medium">sensor_id</th>
                      <th className="px-3 py-2 font-medium">value</th>
                      <th className="px-3 py-2 font-medium">alarm</th>
                      <th className="px-3 py-2 font-medium">timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {[
                      ['018', '1', '28.4', '0', '10:18:05'],
                      ['019', '1', '29.1', '0', '10:18:10'],
                      ['020', '1', '31.7', '1', '10:18:15'],
                      ['021', '1', '32.4', '1', '10:18:20'],
                    ].map((row) => (
                      <tr key={row[0]} className={row[3] === '1' ? 'bg-amber-50' : ''}>
                        {row.map((cell) => (
                          <td key={cell} className="px-3 py-2 font-mono text-xs text-slate-700">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 grid gap-4">
                {dataCases.map((item) => {
                  const selected = dataAnswers[item.id];
                  return (
                    <div key={item.id} className="rounded-md border border-slate-200 bg-[#fbfcf8] p-4">
                      <h3 className="font-semibold">{item.title}</h3>
                      <ul className="mt-3 space-y-1 text-sm leading-6 text-slate-700">
                        {item.evidence.map((evidence) => (
                          <li key={evidence}>证据：{evidence}</li>
                        ))}
                      </ul>
                      <div className="mt-3 grid gap-2">
                        {item.options.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setDataAnswers((current) => ({ ...current, [item.id]: option }))}
                            className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                              selected === option
                                ? 'border-slate-950 bg-slate-950 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      {showDataFeedback ? (
                        <Feedback correct={selected === item.answer} explanation={item.explanation} />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </article>

            <aside className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">故障注入与数据证据</h3>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <p className="rounded-md bg-slate-50 p-3">手动设置传感器故障：源头没有正确数据，数据库和页面会同步异常。</p>
                <p className="rounded-md bg-slate-50 p-3">手动设置网络故障：micro:bit 可能能读数，但 Flask 收不到 GET /upload?id=...&val=... 请求。</p>
                <p className="rounded-md bg-slate-50 p-3">手动设置执行器故障：数据库有 alarm = 1，服务器返回指令，但蜂鸣器不执行。</p>
                <p className="rounded-md bg-slate-50 p-3">手动设置页面故障：数据库有记录，但用户端看不到或看错数据。</p>
              </div>
            </aside>
          </section>
        </TabsContent>

        <TabsContent value="summary" className="mt-5">
          <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
            <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <BookOpenCheck className="h-5 w-5 text-slate-700" />
                <h2 className="text-2xl font-semibold tracking-tight">课堂知识梳理</h2>
              </div>
              <div className="mt-6 grid place-items-center overflow-x-auto rounded-md border border-slate-200 bg-[#fbfcf8] p-5">
                <div className="grid min-w-[720px] grid-cols-[1fr_180px_1fr] items-center gap-5">
                  <div className="grid gap-4">
                    {summaryNodes.slice(0, 3).map(([title, text]) => (
                      <div key={title} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="font-semibold">{title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                      </div>
                    ))}
                  </div>
                  <div className="relative flex h-[360px] items-center justify-center">
                    <div className="absolute inset-x-0 top-1/2 h-px bg-slate-300" />
                    <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300" />
                    <div className="relative rounded-md bg-slate-950 px-5 py-4 text-center text-white shadow-sm">
                      信息系统
                      <span className="mt-1 block text-xs text-slate-300">教室温度检测系统</span>
                    </div>
                  </div>
                  <div className="grid gap-4">
                    {summaryNodes.slice(3).map(([title, text]) => (
                      <div key={title} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="font-semibold">{title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                      </div>
                    ))}
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                      <p className="font-semibold">综合应用</p>
                      <p className="mt-2 text-sm leading-6">沿数据流排查：采集是否正确，程序是否匹配引脚，网络是否到达服务器，数据库是否新增，用户端是否能查询。</p>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <aside className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">下课前自检</h3>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 text-emerald-700" />我能说出信息系统五个组成部分，并能解释“人”的作用。</p>
                <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 text-emerald-700" />我能根据画布说出温度传感器 DATA 接 P1、蜂鸣器 IO 接 P2。</p>
                <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 text-emerald-700" />我能说清上传 GET /upload 需要 id、val，查询首页 GET / 不需要上传参数。</p>
                <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 text-emerald-700" />我能根据数据库、日志、页面现象反查故障位置。</p>
              </div>
              <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <p className="font-medium text-slate-950">一句话总结</p>
                <p className="mt-2">
                  一个信息系统不是单个设备或单段程序，而是由人组织硬件、软件、网络和数据共同完成信息采集、处理、传输、存储和呈现。
                </p>
              </div>
            </aside>
          </section>
        </TabsContent>
      </Tabs>

      <div className="fixed bottom-5 right-5 hidden rounded-md border border-slate-200 bg-white px-4 py-3 text-sm shadow-lg md:flex md:items-center md:gap-2">
        <Play className="h-4 w-4 text-emerald-700" />
        <span>按 tab 顺序推进课堂活动</span>
      </div>
    </main>
  );
}

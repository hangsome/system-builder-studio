# 信息系统搭建模拟器

面向教学与实训的物联网信息系统仿真平台，支持“硬件连线 -> 代码编辑 -> 数据库 -> 运行日志 -> 浏览器结果”全链路演示。

## 分支说明

1. `school-teaching-edition`：教学免费版，强调课堂可演示和教学材料完整性。
2. `main`：商业版主线，包含激活、后台和发卡回调能力。

## 功能概览

1. 拖拽式组件搭建与连线验证。
2. micro:bit / Flask 代码编辑与仿真执行。
3. 数据库实时查看、查询与导出。
4. 浏览器侧结果展示与告警联动。
5. 本地手动快照保存/恢复（教学演示回放）。

## 快速开始

```bash
npm install
npm run dev
```

打开浏览器访问终端输出地址，默认可进入模拟器主页。

## 常用命令

```bash
npm run test
npm run lint
npm run build
```

## 教学资料

教学版配套文档位于 `docs/teaching/`：

1. `docs/teaching/teacher-guide.md`：2-4 课时授课指南。
2. `docs/teaching/student-lab-sheet.md`：学生实验任务单。
3. `docs/teaching/classroom-checklist.md`：课堂前中后检查清单。
4. `docs/teaching/troubleshooting.md`：常见故障排查。

## 商业落地与运营资料

1. `docs/business/commercial-readiness-checklist.md`：商业落地必备条件与验收矩阵。
2. `docs/marketing/wechat-campaign-board.md`：公众号首发板书、宣传与售卖执行模板。

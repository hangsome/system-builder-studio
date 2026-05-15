import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, Loader2, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { enterOpenClassApi } from '@/api/eduApi';
import { useAuthStore } from '@/store/authStore';
import { loadScenario } from '@/data/scenarios';
import { useSimulatorStore } from '@/store/simulatorStore';

type EntryState = 'loading' | 'ready' | 'error';

const OPENCLASS_CANVAS_INITIALIZED_KEY = 'openclass-classroom-canvas-initialized';
const OPENCLASS_CANVAS_VERSION_KEY = 'openclass-classroom-canvas-version';
const CURRENT_OPENCLASS_CANVAS_VERSION = '2026-05-14-hardware-challenge';

export default function OpenClassEntryPage() {
  const navigate = useNavigate();
  const hydrated = useAuthStore((state) => state.hydrated);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setSession = useAuthStore((state) => state.setSession);
  const [state, setState] = useState<EntryState>('loading');
  const [message, setMessage] = useState('正在进入公开课画布，请稍候。');
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);

  const prepareOpenClassWorkspace = () => {
    const classroomScenario = loadScenario('classroom-temperature');
    if (classroomScenario) {
      useSimulatorStore.getState().loadScenario(classroomScenario);
    } else {
      useSimulatorStore.getState().resetSimulator();
    }

    try {
      window.localStorage.setItem(OPENCLASS_CANVAS_INITIALIZED_KEY, CURRENT_OPENCLASS_CANVAS_VERSION);
      window.localStorage.setItem(OPENCLASS_CANVAS_VERSION_KEY, CURRENT_OPENCLASS_CANVAS_VERSION);
    } catch {
      // 忽略存储失败。
    }
  };

  const enterClass = async () => {
    setState('loading');
    setMessage('正在进入公开课画布，请稍候。');
    try {
      clearSession();
      prepareOpenClassWorkspace();
      const response = await enterOpenClassApi();
      setSession(response.token, response.user);
      const nextPath = `/student/workspace/${response.assignment.id}`;
      setWorkspacePath(nextPath);
      setState('ready');
      setMessage('已进入公开课身份，正在打开学生画布。');
      navigate(nextPath, { replace: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '公开课入口暂时不可用';
      setState('error');
      setMessage(errorMessage);
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    void enterClass();
    // 这里只在公开课入口初始化一次，避免导航时重复请求。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  return (
    <main className="min-h-[100dvh] bg-slate-950 text-slate-50">
      <section className="relative min-h-[100dvh] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(14,165,233,0.24),transparent_30%),radial-gradient(circle_at_80%_18%,rgba(16,185,129,0.18),transparent_28%),linear-gradient(135deg,#0f172a,#020617)]" />
        <div className="relative mx-auto grid min-h-[100dvh] max-w-6xl items-center gap-8 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/20 bg-sky-200/10 px-4 py-2 text-sm text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <BookOpenCheck className="h-4 w-4" />
              信息系统复习课学生入口
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
                不用输入账号，直接进入课堂画布
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                系统会自动使用公开课学生身份进入本节课作业。提交画布时只填写自己的姓名，教师后台会查看画布内容并自动统计成绩。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['第一步', '自动进入', '无需手动登录，避免账号角色导致 403'],
                ['第二步', '完成画布', '连线、引脚、URL 与故障排查都在画布中完成'],
                ['第三步', '实名提交', '提交窗口只填写姓名，教师后台可见'],
              ].map(([step, title, helper]) => (
                <div key={step} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{step}</p>
                  <p className="mt-2 text-xl font-semibold text-white">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{helper}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-sm text-slate-400">当前状态</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  {state === 'error' ? '需要重新尝试' : state === 'ready' ? '正在跳转' : '正在准备'}
                </h2>
              </div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 text-sky-200">
                {state === 'loading' ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-center gap-3">
                  <UserRoundCheck className="h-5 w-5 text-emerald-200" />
                  <p className="font-medium text-white">公开课身份</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{message}</p>
              </div>

              <div className="rounded-2xl border border-emerald-200/20 bg-emerald-200/10 p-4 text-sm leading-6 text-emerald-50">
                提交时只填写真实姓名。不要把浏览器已有的教师账号页面当作学生入口使用。
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={enterClass} disabled={!hydrated || state === 'loading'} className="bg-sky-200 text-slate-950 hover:bg-sky-100">
                  {state === 'loading' ? '正在进入' : '重新进入课堂'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {workspacePath ? (
                  <Button asChild variant="outline" className="border-white/20 bg-transparent text-slate-100 hover:bg-white/10 hover:text-white">
                    <Link to={workspacePath}>打开画布</Link>
                  </Button>
                ) : null}
                <Button asChild variant="ghost" className="text-slate-300 hover:bg-white/10 hover:text-white">
                  <Link to="/lesson-flow">查看课堂流程</Link>
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSimulatorStore } from '@/store/simulatorStore';

const OPENCLASS_CANVAS_INITIALIZED_KEY = 'openclass-classroom-canvas-initialized';

export default function TeacherBlankCanvasEntryPage() {
  const navigate = useNavigate();

  useEffect(() => {
    try {
      localStorage.removeItem(OPENCLASS_CANVAS_INITIALIZED_KEY);
      localStorage.removeItem('simulator-storage');
    } catch {
      // localStorage 不可用时仍使用运行态重置兜底。
    }

    useSimulatorStore.getState().resetSimulator();
    navigate('/simulator', { replace: true });
  }, [navigate]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
      <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-sky-200" />
          <div>
            <p className="font-semibold">正在打开教师空白演示画布</p>
            <p className="mt-1 text-sm text-slate-300">本入口只用于教师课堂演示，不会加载学生半成品场景。</p>
          </div>
        </div>
      </div>
    </main>
  );
}

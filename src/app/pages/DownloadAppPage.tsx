import { CheckCircle2, Copy, Download, ShieldCheck, Smartphone, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

const APK_URL = 'https://github.com/ddooxthawsng/note/releases/latest/download/Tool-debug.apk'

export default function DownloadAppPage() {
  async function handleCopyLink() {
    await navigator.clipboard.writeText(APK_URL)
    toast.success('Đã copy link tải APK!')
  }

  return (
    <div className="w-full flex-1 overflow-y-auto p-4 sm:p-6 animate-fade-in-up">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <section className="rounded-2xl border border-hairline/80 bg-canvas-card/85 p-6 sm:p-8 backdrop-blur-xl shadow-lg dark:border-gray-800/80 dark:bg-dark-elevated/85">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-accent-teal text-white shadow-md">
                <Smartphone size={28} />
              </div>
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  <Sparkles size={11} /> Android APK · v1.0
                </span>
                <h1 className="mt-1.5 text-2xl sm:text-3xl font-serif font-normal text-ink dark:text-gray-100">
                  Tool Mobile App
                </h1>
                <p className="mt-1 text-sm text-ink-muted">
                  Đồng bộ Notes thời gian thực, Tasks thông minh, Khối Copy Nhanh và Telegram Drive ngay trên điện thoại Android.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 shrink-0">
              <a
                href={APK_URL}
                target="_blank"
                rel="noopener noreferrer"
                download="Tool-debug.apk"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary-hover active:scale-95"
              >
                <Download size={18} />
                Tải APK cho Android
              </a>
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-hairline bg-canvas/80 px-4 py-2 text-xs font-semibold text-ink-body transition hover:border-primary hover:text-primary dark:border-gray-800 dark:bg-dark/80 dark:text-gray-300"
              >
                <Copy size={14} />
                Copy link tải trực tiếp
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-hairline/80 bg-canvas-card/80 p-5 backdrop-blur-xl dark:border-gray-800/80 dark:bg-dark-elevated/80">
            <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-medium text-ink dark:text-gray-100">
              <CheckCircle2 size={18} className="text-success" /> Tính năng nổi bật
            </h2>
            <ul className="space-y-2 text-sm text-ink-body dark:text-gray-300">
              <li>• Ghi chú cộng tác thời gian thực giữa nhiều tài khoản</li>
              <li>• Dán ảnh/file trực tiếp vào đúng vị trí con trỏ & lưu Telegram Drive</li>
              <li>• Khối Copy Nhanh 1 chạm & Lịch sử 30 phiên bản</li>
              <li>• Nhận diện giọng nói offline (Moonshine) & AI Task Builder</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-hairline/80 bg-canvas-card/80 p-5 backdrop-blur-xl dark:border-gray-800/80 dark:bg-dark-elevated/80">
            <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-medium text-ink dark:text-gray-100">
              <ShieldCheck size={18} className="text-primary" /> Hướng dẫn cài đặt
            </h2>
            <ol className="space-y-2 text-sm text-ink-body dark:text-gray-300">
              <li>1. Bấm <strong>Tải APK cho Android</strong> để tải file <code className="rounded bg-canvas-soft px-1.5 py-0.5 text-xs dark:bg-dark">Tool-debug.apk</code>.</li>
              <li>2. Mở file APK vừa tải trên điện thoại Android.</li>
              <li>3. Nếu được hỏi, bật quyền <strong>Cho phép cài đặt từ nguồn này</strong>.</li>
              <li>4. Đăng nhập bằng Google hoặc Email/Mật khẩu đã được duyệt.</li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  )
}

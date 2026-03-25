import { Button, Icon } from '@stellar/design-system';
import { useTranslation } from 'react-i18next';

type PageErrorFallbackProps = {
  error?: Error;
  resetError?: () => void;
  title?: string;
  description?: string;
  showRetry?: boolean;
};

export default function PageErrorFallback({
  title,
  description,
  resetError,
  showRetry = true,
}: PageErrorFallbackProps) {
  const { t } = useTranslation();

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <header
        className="fixed top-0 left-0 right-0 z-50 h-(--header-h) items-center px-16 flex justify-between backdrop-blur-[20px] backdrop-saturate-180 border-b"
        style={{
          background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
          borderColor: 'var(--border-hi)',
        }}
      >
        <a className="flex items-center gap-2.5" href="/">
          <div className="w-8 h-8 rounded-lg grid place-items-center font-extrabold text-black text-sm tracking-tight shadow-[0_0_20px_rgba(74,240,184,0.3)] bg-linear-to-br from-(--accent) to-(--accent2)">
            P
          </div>
          <span className="text-lg font-extrabold tracking-tight">
            Pay<span className="text-(--accent)">D</span>
          </span>
          <span className="text-[9px] font-normal font-mono text-(--muted) tracking-widest uppercase border border-(--border-hi) px-1.5 py-0.5 rounded ml-0.5">
            BETA
          </span>
        </a>
      </header>

      <main className="flex flex-col flex-1 pt-(--header-h)">
        <div className="flex flex-col flex-1 px-6 py-8">
          <div className="flex-1 flex items-center justify-center">
            <div className="card glass noise max-w-lg w-full text-center p-12">
              <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-danger/10 border-2 border-danger/30">
                <Icon.AlertTriangle size="xl" className="text-danger" />
              </div>
              <h1 className="text-3xl font-bold mb-3">
                {title ?? t('errorFallback.pageErrorTitle')}
              </h1>
              <p className="text-muted text-base mb-8 leading-relaxed">
                {description ?? t('errorFallback.pageErrorDescription')}
              </p>
              <div className="flex items-center justify-center gap-4">
                {showRetry && resetError && (
                  <Button variant="primary" size="sm" onClick={resetError}>
                    {t('errorFallback.tryAgain')}
                  </Button>
                )}
                <a
                  href="/"
                  className="px-6 py-2.5 rounded-lg border border-hi text-sm font-medium text-text hover:bg-white/5 transition-colors inline-flex items-center"
                >
                  {t('errorFallback.goHome')}
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer
        className="flex flex-wrap justify-between items-center gap-2 px-6 py-5 border-t text-xs font-mono text-(--muted)"
        style={{ borderColor: 'var(--border-hi)' }}
      >
        <span>
          © {new Date().getFullYear()} PayD — Licensed under the{' '}
          <a
            href="http://www.apache.org/licenses/LICENSE-2.0"
            target="_blank"
            rel="noopener noreferrer"
            className="text-(--accent) hover:underline"
          >
            Apache License 2.0
          </a>
        </span>
      </footer>
    </div>
  );
}

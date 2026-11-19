import React, { Suspense, lazy, useEffect, useState } from 'react';
import App from './App';
import { StallLoader } from './components/StallLoader';

const BuilderPage = lazy(() => import('./pages/BuilderPage').then((m) => ({ default: m.BuilderPage })));
const ManageApp = lazy(() => import('./pages/manage/ManageApp').then((m) => ({ default: m.ManageApp })));

const isManage = () =>
  window.location.pathname.startsWith('/manage') ||
  window.location.hash.startsWith('#/manage') ||
  window.location.hash.startsWith('#manage');

const isBuilder = () => window.location.hash.startsWith('#/build');

// Router supporting /manage, #/build (Builder), and public portfolio
export default function Root() {
  const [manage, setManage] = useState<boolean>(isManage());
  const [builder, setBuilder] = useState<boolean>(isBuilder());
  const [prefill, setPrefill] = useState<string>('');

  useEffect(() => {
    const onRoute = () => {
      const m = isManage();
      const b = isBuilder();
      setManage(m);
      setBuilder(b);
      if (b || m) window.scrollTo({ top: 0 });
    };

    window.addEventListener('hashchange', onRoute);
    window.addEventListener('popstate', onRoute);
    return () => {
      window.removeEventListener('hashchange', onRoute);
      window.removeEventListener('popstate', onRoute);
    };
  }, []);

  if (manage) {
    return (
      <Suspense fallback={<StallLoader label="Loading Operations Command Center..." className="fixed inset-0 rounded-none bg-zinc-950 text-amber-500" />}>
        <ManageApp />
      </Suspense>
    );
  }

  if (builder) {
    return (
      <Suspense fallback={<StallLoader label="Opening the stall builder" className="fixed inset-0 rounded-none" />}>
        <BuilderPage
          onRequestQuote={(summary) => {
            setPrefill(summary);
            window.location.hash = '#enquiry';
          }}
        />
      </Suspense>
    );
  }
  return <App key={prefill} initialPrefill={prefill} />;
}

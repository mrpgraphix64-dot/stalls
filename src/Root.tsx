import React, { Suspense, lazy, useEffect, useState } from 'react';
import App from './App';
import { StallLoader } from './components/StallLoader';

const BuilderPage = lazy(() => import('./pages/BuilderPage').then((m) => ({ default: m.BuilderPage })));

const isBuilder = () => window.location.hash.startsWith('#/build');

// Minimal hash router: "#/build" shows the stall builder, everything else is the portfolio.
export default function Root() {
  const [builder, setBuilder] = useState<boolean>(isBuilder());
  const [prefill, setPrefill] = useState<string>('');

  useEffect(() => {
    const onHash = () => {
      const b = isBuilder();
      setBuilder(b);
      if (b) window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

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

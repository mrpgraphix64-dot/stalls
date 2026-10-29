import React, { useEffect, useState } from 'react';
import App from './App';
import { BuilderPage } from './pages/BuilderPage';

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
      <BuilderPage
        onRequestQuote={(summary) => {
          setPrefill(summary);
          window.location.hash = '#enquiry';
        }}
      />
    );
  }
  return <App key={prefill} initialPrefill={prefill} />;
}

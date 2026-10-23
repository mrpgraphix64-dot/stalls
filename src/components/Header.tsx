import React, { useState, useEffect } from 'react';
import { Menu, X, ArrowUpRight, Phone, Mail } from 'lucide-react';

interface HeaderProps {
  onQuoteClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onQuoteClick }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Portfolio', href: '#gallery' },
    { label: 'Case Studies', href: '#projects' },
    { label: 'Services', href: '#services' },
    { label: 'Our Process', href: '#process' },
    { label: 'Contact', href: '#enquiry' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-200 bg-white border-b border-gray-200/90 shadow-[0_2px_10px_rgba(0,0,0,0.04)] ${
        isScrolled ? 'py-2.5 md:py-3' : 'py-3.5 md:py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a
            href="#"
            className="flex items-center gap-3 group focus:outline-none"
            aria-label="Reworkzone Stalls Portfolio"
          >
            <div className="relative h-10 w-auto flex items-center">
              <img
                src="/logo.png"
                alt="Reworkzone"
                className="h-9 md:h-10 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
              />
            </div>
            <div className="hidden sm:flex flex-col border-l border-brand-subtle pl-3 ml-1">
              <span className="text-xs font-bold tracking-widest text-brand-dark uppercase">
                Stalls
              </span>
              <span className="text-[10px] tracking-wider text-gray-500 uppercase font-medium">
                Design & Fabrication
              </span>
            </div>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-brand-dark hover:bg-black/5 rounded-md transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="tel:+918401060482"
              className="text-xs font-semibold text-gray-600 hover:text-brand-dark flex items-center gap-1.5 px-2.5 py-1.5 transition-colors"
              title="Call Reworkzone"
            >
              <Phone className="w-3.5 h-3.5 text-brand-red" />
              <span>+91 84010 60482</span>
            </a>
            <button
              onClick={onQuoteClick}
              className="inline-flex items-center gap-1.5 bg-brand-dark hover:bg-brand-red text-white text-xs lg:text-sm font-semibold tracking-wide uppercase px-5 py-2.5 rounded-full transition-all duration-200 shadow-sm hover:shadow group"
            >
              <span>Get a Quote</span>
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={onQuoteClick}
              className="bg-brand-red text-white text-[11px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-full"
            >
              Quote
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-700 hover:text-black rounded-lg focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 px-6 pt-4 pb-6 space-y-4 shadow-xl">
          <div className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 text-base font-semibold text-brand-dark border-b border-brand-subtle/50 flex items-center justify-between"
              >
                <span>{link.label}</span>
                <ArrowUpRight className="w-4 h-4 text-gray-400" />
              </a>
            ))}
          </div>

          <div className="pt-2 flex flex-col gap-2.5 text-sm text-gray-600">
            <a
              href="tel:+918401060482"
              className="flex items-center gap-2 py-1.5 text-gray-800 font-medium"
            >
              <Phone className="w-4 h-4 text-brand-red" />
              <span>+91 84010 60482</span>
            </a>
            <a
              href="mailto:info@reworkzone.in"
              className="flex items-center gap-2 py-1.5 text-gray-800 font-medium"
            >
              <Mail className="w-4 h-4 text-brand-red" />
              <span>info@reworkzone.in</span>
            </a>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onQuoteClick();
              }}
              className="w-full mt-2 bg-brand-red text-white text-center font-bold uppercase text-xs tracking-wider py-3.5 rounded-xl shadow"
            >
              Plan Your Exhibition Stall
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

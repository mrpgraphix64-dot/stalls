import React from 'react';
import { ArrowUpRight, Phone, Mail, MapPin } from 'lucide-react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-brand-dark text-white pt-16 pb-12 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 pb-12 border-b border-gray-800">
          
          {/* Brand info */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo-white.png"
                alt="Reworkzone"
                className="h-9 w-auto object-contain"
              />
              <div className="border-l border-gray-700 pl-3">
                <div className="text-xs font-bold tracking-widest uppercase text-white">Stalls</div>
                <div className="text-[10px] text-gray-400 uppercase">Design & Fabrication</div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-sm font-light">
              Reworkzone specializes in bespoke exhibition stalls, 3D architectural visualization, and turnkey booth fabrication for domestic and international trade expos.
            </p>

            <div className="pt-2">
              <a
                href="https://reworkzone.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-brand-orange hover:text-white font-medium transition-colors"
              >
                <span>Visit Main Reworkzone Website</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Quick Portfolio Links */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Portfolio
            </h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li>
                <a href="#gallery" className="hover:text-white transition-colors">All Projects</a>
              </li>
              <li>
                <a href="#projects" className="hover:text-white transition-colors">Case Studies</a>
              </li>
              <li>
                <a href="#gallery" className="hover:text-white transition-colors">3D Concepts & Renders</a>
              </li>
              <li>
                <a href="#gallery" className="hover:text-white transition-colors">Corporate Expo Booths</a>
              </li>
              <li>
                <a href="#gallery" className="hover:text-white transition-colors">Brand Pavilions</a>
              </li>
            </ul>
          </div>

          {/* Services Links */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Services
            </h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li>
                <a href="#services" className="hover:text-white transition-colors">3D Stall Design</a>
              </li>
              <li>
                <a href="#services" className="hover:text-white transition-colors">Custom Fabrication</a>
              </li>
              <li>
                <a href="#services" className="hover:text-white transition-colors">Modular Systems</a>
              </li>
              <li>
                <a href="#services" className="hover:text-white transition-colors">Backlit Graphics & AV</a>
              </li>
              <li>
                <a href="#services" className="hover:text-white transition-colors">On-Site Execution</a>
              </li>
            </ul>
          </div>

          {/* Verified Contact Info */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Contact & Inquiries
            </h4>
            <ul className="space-y-2.5 text-xs text-gray-400">
              <li className="flex items-start gap-2.5">
                <Phone className="w-3.5 h-3.5 text-brand-red shrink-0 mt-0.5" />
                <div>
                  <a href="tel:+918401060482" className="hover:text-white transition-colors font-medium">
                    +91 84010 60482
                  </a>
                  <div className="text-[10px] text-gray-500">Call / WhatsApp</div>
                </div>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-3.5 h-3.5 text-brand-red shrink-0" />
                <a href="mailto:info@reworkzone.in" className="hover:text-white transition-colors">
                  info@reworkzone.in
                </a>
              </li>
              <li className="flex items-start gap-2.5 pt-1">
                <MapPin className="w-3.5 h-3.5 text-brand-red shrink-0 mt-0.5" />
                <div className="text-[11px] text-gray-400">
                  Ahmedabad, Gujarat, India
                </div>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div>
            © {currentYear} Reworkzone. All rights reserved. Standalone exhibition portfolio on <span className="text-gray-400">stalls.reworkzone.in</span>.
          </div>
          <div className="flex items-center gap-6">
            <a href="#gallery" className="hover:text-gray-300 transition-colors">Back to Top ↑</a>
          </div>
        </div>

      </div>
    </footer>
  );
};

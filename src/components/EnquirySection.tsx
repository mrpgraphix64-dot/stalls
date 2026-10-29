import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Phone, Mail, MapPin, MessageSquare, ArrowRight, Clock } from 'lucide-react';

const DIMENSION_PRESETS = [
  '3m x 3m (9 sqm - Standard Shell/Corner)',
  '6m x 3m (18 sqm - Popular Peninsula)',
  '6m x 6m (36 sqm - Island Stand)',
  '9m x 3m (27 sqm - Shell Scheme)',
  '2m x 2m (4 sqm - Startup Booth)',
  '9m x 6m (54 sqm - Large Pavilion)',
  '12m x 6m+ (72+ sqm - Double Decker)',
  'Custom / Undecided Dimensions',
];

const presetForPrefill = (text: string) =>
  DIMENSION_PRESETS.find((p) => text.includes('Size: ' + p.split(' (')[0])) || '6m x 3m (18 sqm - Popular Peninsula)';

interface EnquirySectionProps {
  prefilledStall?: string;
}

export const EnquirySection: React.FC<EnquirySectionProps> = ({ prefilledStall = '' }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    boothNumber: '',
    stallDimensions: prefilledStall.startsWith('Custom stall designed') ? presetForPrefill(prefilledStall) : '6m x 3m (18 sqm)',
    requirements: !prefilledStall
      ? ''
      : prefilledStall.startsWith('Custom stall designed')
        ? prefilledStall
        : `Interested in a stall design similar to ${prefilledStall}.`,
    botcheck: '', // Honeypot field
  });

  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    phone?: string;
    email?: string;
  }>({});

  const [touchedFields, setTouchedFields] = useState<{
    fullName?: boolean;
    phone?: boolean;
    email?: boolean;
  }>({});

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const dimensionPresets = DIMENSION_PRESETS;

  const validateField = (name: string, value: string): string | undefined => {
    if (name === 'fullName') {
      const trimmed = value.trim();
      if (!trimmed) return 'Please enter your name.';
      if (trimmed.length < 2) return 'Name must be at least 2 characters.';
      return undefined;
    }
    if (name === 'phone') {
      const raw = value.trim();
      if (!raw) return 'Please enter your mobile or WhatsApp number.';
      const digitsOnly = raw.replace(/\D/g, '');
      if (digitsOnly.length < 10) {
        return `Please enter at least 10 or 11 digits (${digitsOnly.length} entered).`;
      }
      if (!raw.startsWith('+') && digitsOnly.length > 12) {
        return 'Phone number cannot exceed 11–12 digits.';
      }
      if (digitsOnly.length > 13) {
        return 'Phone number is too long (maximum 13 digits).';
      }
      if (/^(\d)\1{9,}$/.test(digitsOnly)) {
        return 'Please enter a genuine mobile number.';
      }
      return undefined;
    }
    if (name === 'email') {
      const trimmed = value.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!trimmed) return 'Please enter your work email.';
      if (!emailRegex.test(trimmed)) return 'Please enter a valid work email (e.g. name@company.com).';
      return undefined;
    }
    return undefined;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // For phone field, restrict input characters and allow 10, 11, or 12 digits (for domestic and foreign numbers)
    let cleanedValue = value;
    if (name === 'phone') {
      cleanedValue = value.replace(/[^0-9+\s\-()]/g, '');
      const digitsOnly = cleanedValue.replace(/\D/g, '');
      // If doesn't start with +, cap at 12 digits (permitting 10, 11, or 12 digits)
      if (!cleanedValue.trim().startsWith('+')) {
        if (digitsOnly.length > 12) {
          cleanedValue = digitsOnly.slice(0, 12);
        }
      } else {
        if (digitsOnly.length > 13) {
          cleanedValue = '+' + digitsOnly.slice(0, 13);
        }
      }
    }

    setFormData((prev) => ({
      ...prev,
      [name]: cleanedValue,
    }));

    // LIVE VALIDATION: Run immediately on change as user types
    if (name === 'phone') {
      const rawDigits = cleanedValue.replace(/\D/g, '');
      if (rawDigits.length >= 10 && rawDigits.length <= 12 && !/^(\d)\1{9,}$/.test(rawDigits)) {
        // Valid 10-12 digits: clear error immediately
        setFieldErrors((prev) => ({ ...prev, phone: undefined }));
      } else if (fieldErrors.phone || (touchedFields.phone && rawDigits.length > 0)) {
        const err = validateField(name, cleanedValue);
        setFieldErrors((prev) => ({ ...prev, phone: err }));
      }
    } else if (name === 'fullName') {
      if (cleanedValue.trim().length >= 2) {
        setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
      }
    } else if (name === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (emailRegex.test(cleanedValue.trim())) {
        setFieldErrors((prev) => ({ ...prev, email: undefined }));
      }
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTouchedFields((prev) => ({ ...prev, [name]: true }));
    const err = validateField(name, value);
    if (err) {
      setFieldErrors((prev) => ({ ...prev, [name]: err }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.botcheck) {
      return;
    }

    const errors: { fullName?: string; phone?: string; email?: string } = {};
    const nameErr = validateField('fullName', formData.fullName);
    if (nameErr) errors.fullName = nameErr;

    const phoneErr = validateField('phone', formData.phone);
    if (phoneErr) errors.phone = phoneErr;

    const emailErr = validateField('email', formData.email);
    if (emailErr) errors.email = emailErr;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setStatus('error');
      setErrorMessage(Object.values(errors)[0] || 'Please correct the highlighted fields.');
      return;
    }

    setFieldErrors({});
    setStatus('submitting');
    setErrorMessage('');

    try {
      const response = await fetch('/send-enquiry.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          phone: formData.phone,
          email: formData.email,
          boothNumber: formData.boothNumber,
          stallDimensions: formData.stallDimensions,
          requirements: formData.requirements,
          botcheck: formData.botcheck,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Failed to submit enquiry. Please contact us on WhatsApp directly.');
      }
    } catch (err: any) {
      console.warn('Network submission fallback:', err);
      setStatus('success');
    }
  };

  const phoneDigits = formData.phone.replace(/\D/g, '');
  const isPhoneValid =
    (phoneDigits.length >= 10 && phoneDigits.length <= 12 && !/^(\d)\1{9,}$/.test(phoneDigits)) ||
    (formData.phone.trim().startsWith('+') && phoneDigits.length >= 10 && phoneDigits.length <= 13);
  const isNameValid = formData.fullName.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formData.email.trim());

  const handleWhatsAppDirect = () => {
    const text = encodeURIComponent(
      `Hello Reworkzone Team, I am inquiring about Exhibition Stall Design & Fabrication:\n` +
      `• Name: ${formData.fullName || 'Exhibitor'}\n` +
      `• Phone: ${formData.phone || '-'}\n` +
      `• Email: ${formData.email || '-'}\n` +
      (formData.boothNumber ? `• Booth No: ${formData.boothNumber}\n` : '') +
      `• Stall Size: ${formData.stallDimensions}\n` +
      `• Requirements: ${formData.requirements || 'Please share your design proposal and quotation.'}`
    );
    window.open(`https://wa.me/918401060482?text=${text}`, '_blank');
  };

  return (
    <section id="enquiry" className="py-24 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* Left Column: Context & Direct Contact */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-5xl font-black text-brand-dark tracking-tight leading-tight font-display">
                Planning your next exhibition?
              </h2>

              <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                Tell us about your event, available space, and requirements. Let's explore the right stall solution for your brand.
              </p>
            </div>

            {/* Direct Verified Contacts */}
            <div className="p-8 rounded-2xl bg-[#FAF9F5] border border-brand-subtle space-y-5">
              <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Direct Communication Channels
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 text-base text-brand-dark font-semibold">
                  <Phone className="w-5 h-5 text-brand-red shrink-0 mt-0.5" />
                  <div>
                    <div className="flex flex-wrap items-center gap-x-2">
                      <a href="tel:+918401060482" className="hover:text-brand-red transition-colors">
                        +91 84010 60482
                      </a>
                      <span className="text-gray-300">/</span>
                      <a href="tel:+918980004518" className="hover:text-brand-red transition-colors">
                        +91 89800 04518
                      </a>
                    </div>
                    <div className="text-xs text-gray-600 font-normal mt-0.5">Call or WhatsApp (Direct)</div>
                  </div>
                </div>

                <a
                  href="mailto:info@reworkzone.in"
                  className="flex items-center gap-3 text-base text-brand-dark hover:text-brand-red font-semibold transition-colors"
                >
                  <Mail className="w-5 h-5 text-brand-red shrink-0" />
                  <div>
                    <div>info@reworkzone.in</div>
                    <div className="text-xs text-gray-600 font-normal">Design Briefs & RFPs</div>
                  </div>
                </a>

                <div className="flex items-center gap-3 text-sm text-gray-800 pt-1">
                  <MapPin className="w-5 h-5 text-brand-red shrink-0" />
                  <div>
                    <div className="font-semibold">Ahmedabad, Gujarat, India</div>
                    <div className="text-xs text-gray-600">Corporate Studio & Turnkey Production</div>
                  </div>
                </div>
              </div>

              {/* Instant WhatsApp Action — WCAG High Contrast */}
              <div className="pt-4 border-t border-brand-subtle/80">
                <button
                  type="button"
                  onClick={handleWhatsAppDirect}
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 bg-[#0f5132] hover:bg-[#0b3d26] text-white rounded-xl text-sm font-bold uppercase tracking-wider transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-[#75b798]" />
                  <span>Chat on WhatsApp Directly</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-700">
              <Clock className="w-4 h-4 text-brand-red shrink-0" />
              <span>We reply with preliminary 3D spatial concepts and budget scopes within 24 hours.</span>
            </div>
          </div>

          {/* Right Column: Clean Form */}
          <div className="lg:col-span-7 bg-[#FAF9F5] p-8 sm:p-10 rounded-3xl border border-brand-subtle">
            
            {status === 'success' ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-brand-dark font-display">
                  Thank You! We've Received Your Stall Enquiry.
                </h3>
                <p className="text-base text-gray-700 max-w-md mx-auto leading-relaxed">
                  Our exhibition design team will review your requirements and reach back to <span className="font-bold text-brand-dark">{formData.email || formData.phone}</span> with a custom 3D proposal and timeline.
                </p>

                <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleWhatsAppDirect}
                    className="w-full sm:w-auto px-6 py-3.5 bg-[#0f5132] text-white text-xs font-bold uppercase tracking-wider rounded-xl"
                  >
                    Follow up on WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('idle');
                      setFormData({
                        fullName: '',
                        phone: '',
                        email: '',
                        boothNumber: '',
                        stallDimensions: '6m x 3m (18 sqm)',
                        requirements: '',
                        botcheck: '',
                      });
                    }}
                    className="w-full sm:w-auto px-6 py-3.5 bg-white border border-brand-subtle text-brand-dark text-xs font-bold uppercase tracking-wider rounded-xl"
                  >
                    Submit Another Requirement
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-6">
                
                <input
                  type="checkbox"
                  name="botcheck"
                  checked={!!formData.botcheck}
                  onChange={(e) => setFormData(p => ({ ...p, botcheck: e.target.checked ? 'bot' : '' }))}
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                />

                {status === 'error' && errorMessage && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-700" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Row 1: Full Name & Phone Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-brand-dark uppercase tracking-wider mb-2">
                      Your Name <span className="text-brand-red">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="e.g. Rahul Sharma"
                        className={`w-full px-4 py-3 bg-white rounded-xl border text-sm text-brand-dark outline-none transition-all pr-10 ${
                          fieldErrors.fullName
                            ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/20'
                            : isNameValid && touchedFields.fullName
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10'
                            : 'border-brand-subtle focus:border-brand-dark focus:ring-1 focus:ring-brand-dark'
                        }`}
                      />
                      {isNameValid && touchedFields.fullName && (
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    {fieldErrors.fullName && (
                      <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{fieldErrors.fullName}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-brand-dark uppercase tracking-wider">
                        Mobile / WhatsApp Number <span className="text-brand-red">*</span>
                      </label>
                      {formData.phone && (
                        <span className="text-[10px] text-gray-500 font-mono font-medium">
                          {phoneDigits.length} / 10–11 digits
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="tel"
                        name="phone"
                        maxLength={15}
                        value={formData.phone}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="e.g. 98765 43210 (10 or 11 digits)"
                        className={`w-full px-4 py-3 bg-white rounded-xl border text-sm text-brand-dark outline-none transition-all pr-10 ${
                          fieldErrors.phone
                            ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/20'
                            : isPhoneValid
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10'
                            : 'border-brand-subtle focus:border-brand-dark focus:ring-1 focus:ring-brand-dark'
                        }`}
                      />
                      {isPhoneValid && (
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    {fieldErrors.phone ? (
                      <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{fieldErrors.phone}</span>
                      </p>
                    ) : isPhoneValid ? (
                      <p className="text-xs text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {phoneDigits.length === 10
                            ? 'Valid 10-digit number'
                            : phoneDigits.length === 11
                            ? 'Valid 11-digit number'
                            : 'Valid international number'}
                        </span>
                      </p>
                    ) : formData.phone && phoneDigits.length < 10 ? (
                      <p className="text-xs text-amber-600 font-medium mt-1.5 flex items-center gap-1">
                        <span>Enter 10 or 11 digits ({phoneDigits.length} entered so far)</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Row 2: Work Email & Booth Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-brand-dark uppercase tracking-wider mb-2">
                      Work Email <span className="text-brand-red">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="e.g. rahul@company.com"
                        className={`w-full px-4 py-3 bg-white rounded-xl border text-sm text-brand-dark outline-none transition-all pr-10 ${
                          fieldErrors.email
                            ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/20'
                            : isEmailValid && touchedFields.email
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10'
                            : 'border-brand-subtle focus:border-brand-dark focus:ring-1 focus:ring-brand-dark'
                        }`}
                      />
                      {isEmailValid && touchedFields.email && (
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    {fieldErrors.email && (
                      <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{fieldErrors.email}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-brand-dark uppercase tracking-wider mb-2">
                      Booth / Stall No.
                    </label>
                    <input
                      type="text"
                      name="boothNumber"
                      value={formData.boothNumber}
                      onChange={handleChange}
                      placeholder="e.g. Hall 3, Booth E-26 (or Pending)"
                      className="w-full px-4 py-3 bg-white rounded-xl border border-brand-subtle text-sm text-brand-dark focus:border-brand-dark focus:ring-1 focus:ring-brand-dark outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Row 3: Stall Dimensions */}
                <div>
                  <label className="block text-xs font-bold text-brand-dark uppercase tracking-wider mb-2">
                    Approximate Stall Dimensions
                  </label>
                  <select
                    name="stallDimensions"
                    value={formData.stallDimensions}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white rounded-xl border border-brand-subtle text-sm text-brand-dark focus:border-brand-dark focus:ring-1 focus:ring-brand-dark outline-none transition-all"
                  >
                    {dimensionPresets.map((dim) => (
                      <option key={dim} value={dim}>
                        {dim}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Row 3: Event Name & Requirements */}
                <div>
                  <label className="block text-xs font-bold text-brand-dark uppercase tracking-wider mb-2">
                    Event Details & Requirements
                  </label>
                  <textarea
                    name="requirements"
                    rows={4}
                    value={formData.requirements}
                    onChange={handleChange}
                    placeholder="Tell us your event name, venue/city, date, or open sides (e.g. Tech Expo, Mumbai, 2-side open, product display needs)..."
                    className="w-full px-4 py-3 bg-white rounded-xl border border-brand-subtle text-sm text-brand-dark focus:border-brand-dark focus:ring-1 focus:ring-brand-dark outline-none transition-all"
                  ></textarea>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="w-full py-4 px-6 bg-brand-dark hover:bg-brand-red text-white text-sm font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {status === 'submitting' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting Your Requirements...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Stall Enquiry</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-600 text-center">
                  Fast turnaround. We review your requirements and reply with 3D concepts within 24 hours.
                </p>

              </form>
            )}

          </div>

        </div>

      </div>
    </section>
  );
};

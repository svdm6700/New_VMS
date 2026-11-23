import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  User,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Home,
  Hash,
  Calendar,
  Users,
  FileText,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { documentService } from '../services/documentService';
import { VerifiedVoter } from '../types/document';
import { useAuth } from '../contexts/AuthContext';

export const VoterVerificationPage: React.FC = () => {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [notFoundError, setNotFoundError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [voter, setVoter] = useState<VerifiedVoter | null>(null);
  const [copied, setCopied] = useState(false);

  // Submit State
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount or when returning to code entry
  useEffect(() => {
    if (!voter && inputRef.current) {
      inputRef.current.focus();
    }
  }, [voter]);

  // Synchronize payment status when voter details load
  useEffect(() => {
    if (voter) {
      setIsPaid(Boolean(voter.is_paid));
      setPaymentSuccess(voter.is_paid ? 'This voter is already PAID.' : null);
      setPaymentError(null);
    }
  }, [voter]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Force uppercase and allow max 5 alphanumeric characters
    const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    setCode(clean);
    if (validationError) setValidationError(null);
    if (notFoundError) setNotFoundError(null);
    if (apiError) setApiError(null);
  };

  const validateCode = (): boolean => {
    const trimmed = code.trim();
    if (!trimmed) {
      setValidationError('Please enter a 5-character voter code.');
      return false;
    }
    if (trimmed.length !== 5 || !/^[A-Z0-9]{5}$/.test(trimmed)) {
      setValidationError('Code must be exactly 5 alphanumeric characters (A-Z, 0-9).');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setValidationError(null);
    setNotFoundError(null);
    setApiError(null);

    if (!validateCode()) {
      return;
    }

    setIsLoading(true);
    try {
      const data = await documentService.verifyVoter(code);
      setVoter(data);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 404) {
        setNotFoundError('Invalid Voter Code');
      } else if (status === 403) {
        const msg = err.response?.data?.detail || 'This voter does not belong to your assigned Ward.';
        setApiError(msg);
      } else {
        const msg = err.response?.data?.detail || err.message || 'An error occurred while verifying the voter code.';
        setApiError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitPayment = async () => {
    const voterId = voter?.id || voter?.voter_db_id;
    if (!voterId) return;
    if (isPaid) return;

    setIsSubmittingPayment(true);
    setPaymentError(null);
    setPaymentSuccess(null);

    try {
      await documentService.submitVoterPayment(voterId);
      setIsPaid(true);
      setPaymentSuccess('Submitted successfully (PAID).');
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Payment submission failed.';
      setPaymentError(msg);
      if (msg.toLowerCase().includes('already paid') || msg.toLowerCase().includes('already completed')) {
        setIsPaid(true);
      }
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleBackToEntry = () => {
    setVoter(null);
    setCode('');
    setIsPaid(false);
    setPaymentSuccess(null);
    setPaymentError(null);
    setValidationError(null);
    setNotFoundError(null);
    setApiError(null);
  };

  const handleCopyCode = () => {
    if (voter?.unique_code) {
      navigator.clipboard.writeText(voter.unique_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-4 sm:py-8 px-2 sm:px-4">
      {/* Voter Details View */}
      {voter ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden animate-in fade-in duration-200">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-700 p-5 sm:p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-white/15 backdrop-blur-md rounded-2xl">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </span>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
                  Verification Successful
                </span>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  {voter.voter_name}
                </h2>
              </div>
            </div>

            {/* Permanent 5-Character Unique Code Badge */}
            <div className="flex items-center gap-2 self-start sm:self-auto bg-black/25 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-white/20">
              <span className="text-[11px] font-medium text-white/80">Unique Code:</span>
              <span className="font-mono font-extrabold text-base tracking-widest text-white">
                {voter.unique_code}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white/90"
                title="Copy Code"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Details Body */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col md:flex-row gap-6 lg:gap-8 items-start">
              {/* Photograph Card */}
              <div className="w-full md:w-48 shrink-0 flex flex-col items-center">
                <div className="w-40 h-52 sm:w-44 sm:h-56 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 overflow-hidden flex items-center justify-center shadow-inner relative group">
                  {voter.photo_base64 || voter.photo_url ? (
                    <img
                      src={voter.photo_base64 || voter.photo_url}
                      alt={voter.voter_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to placeholder on broken image
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-slate-400 dark:text-slate-500 text-center">
                      <User className="w-16 h-16 stroke-1 mb-2 text-slate-300 dark:text-slate-600" />
                      <span className="text-xs font-semibold">ఫోటో అందుబాటులో లేదు</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">(Photo Not Available)</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <span className="inline-block px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {voter.epic_number || 'EPIC N/A'}
                  </span>
                </div>
              </div>

              {/* Voter Information Grid */}
              <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Voter Name */}
                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-brand-600" /> ఓటరు పేరు (Voter Name)
                  </span>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100 font-telugu">
                    {voter.voter_name || '—'}
                  </p>
                </div>

                {/* EPIC Number */}
                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-brand-600" /> ఓటరు ఐడి (EPIC Number)
                  </span>
                  <p className="mt-1 text-sm font-bold font-mono text-brand-700 dark:text-brand-400">
                    {voter.epic_number || '—'}
                  </p>
                </div>

                {/* Father / Husband Name */}
                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-brand-600" />
                    {voter.relation_type && voter.relation_type !== 'Not Available'
                      ? `${voter.relation_type} పేరు`
                      : 'తండ్రి / భర్త పేరు (Father/Husband)'}
                  </span>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100 font-telugu">
                    {voter.father_or_husband_name || voter.relation_name || '—'}
                  </p>
                </div>

                {/* Age & Gender */}
                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-brand-600" /> వయస్సు & లింగం (Age / Gender)
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {voter.age ? `${voter.age} yrs` : '—'}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${voter.gender?.includes('స్త్రీ')
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                          : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                        }`}
                    >
                      {voter.gender || '—'}
                    </span>
                  </div>
                </div>

                {/* House Number */}
                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-brand-600" /> ఇంటి సంఖ్య (House Number)
                  </span>
                  <p className="mt-1 text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                    {voter.house_number || voter.house_no || '—'}
                  </p>
                </div>

                {/* Constituency */}
                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-brand-600" /> నియోజకవర్గం (Constituency)
                  </span>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {voter.constituency || 'Not Available'}
                  </p>
                </div>

                {/* Ward */}
                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-brand-600" /> వార్డు (Ward Number)
                  </span>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {voter.ward || voter.ward_number || 'Not Available'}
                  </p>
                </div>

                {/* Part Number / Serial No */}
                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-brand-600" /> జాబితా భాగం సంఖ్య (Part Number)
                  </span>
                  <p className="mt-1 text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                    {voter.part_number || voter.electoral_roll_no || (voter.serial_no ? `S.No: ${voter.serial_no}` : '—')}
                  </p>
                </div>
              </div>
            </div>

            {/* Submission Feedback Banners */}
            {paymentError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{paymentError}</span>
              </div>
            )}

            {paymentSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{paymentSuccess}</span>
              </div>
            )}

            {/* Actions: Back Button and ONLY Submit Button */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleBackToEntry}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-sm font-bold transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back / Enter Another Code</span>
              </button>

              <button
                type="button"
                onClick={handleSubmitPayment}
                disabled={isSubmittingPayment || isPaid}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-2xl text-sm font-bold shadow-lg transition-all transform ${isPaid
                    ? 'bg-emerald-600 text-white cursor-default opacity-90'
                    : 'bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white shadow-brand-500/25 hover:-translate-y-0.5 cursor-pointer disabled:cursor-not-allowed'
                  }`}
              >
                {isSubmittingPayment ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : isPaid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submitted (PAID)</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Single Screen Code Entry View */
        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-6 sm:p-8 animate-in fade-in duration-200">
          {/* Header */}
          <div className="text-center space-y-2 mb-6">
            <div className="w-14 h-14 bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-brand-200/60 dark:border-brand-900/50">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              Verification
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-telugu">
              ఓటరు ధృవీకరణ కోసం 5 అక్షరాల యూనిక్ కోడ్‌ను నమోదు చేయండి
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="voter-code" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 text-center">
                Code
              </label>

              <div className="relative">
                <input
                  id="voter-code"
                  ref={inputRef}
                  type="text"
                  maxLength={5}
                  value={code}
                  onChange={handleInputChange}
                  placeholder="Enter 5-character Code"
                  autoComplete="off"
                  spellCheck="false"
                  disabled={isLoading}
                  className={`w-full px-4 py-3.5 text-center text-xl sm:text-2xl font-mono font-bold tracking-widest rounded-2xl bg-slate-50 dark:bg-slate-800 border uppercase transition-all focus:outline-none focus:ring-4 ${validationError || notFoundError
                      ? 'border-rose-400 dark:border-rose-600 text-rose-600 focus:ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-brand-500 focus:ring-brand-500/20'
                    }`}
                />
              </div>

              {/* Format Hint / Validation Message */}
              {validationError && (
                <div className="flex items-center justify-center gap-1.5 mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>

            {/* Error Banners */}
            {notFoundError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-2xl text-xs font-bold text-center flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{notFoundError}</span>
              </div>
            )}

            {apiError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-2xl text-xs font-medium text-center flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{apiError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || code.length === 0}
              className="w-full py-3.5 px-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:hover:bg-brand-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Submit</span>
                </>
              )}
            </button>
          </form>

          {/* Clean User Badge Footer */}
          <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400">
            <span>Signed in as </span>
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              {user?.full_name || user?.username}
            </span>
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">
              {user?.role}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

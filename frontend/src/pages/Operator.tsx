import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useReviewQueue } from '../hooks/useReviewQueue';
import { confirmReview, rejectReview, callReporter } from '../lib/api/human-review';
import { CheckCircle, XCircle, Phone, MapPin, Mic, AlertCircle, FileText } from 'lucide-react';

export default function Operator() {
  const { data: reviews, isLoading } = useReviewQueue();
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const qc = useQueryClient();

  const confirmMut = useMutation({ 
    mutationFn: confirmReview, 
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviewQueue'] }) 
  });
  const rejectMut = useMutation({ 
    mutationFn: rejectReview, 
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviewQueue'] }) 
  });
  const callMut = useMutation({ 
    mutationFn: (id: string) => {
      setActiveCallId(id);
      return callReporter(id);
    },
    onSuccess: () => {
      setTimeout(() => setActiveCallId(null), 3500);
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)] text-slate-500 text-xs">
        Loading review queue...
      </div>
    );
  }

  const pendingCount = reviews?.length || 0;

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-slate-950 p-6 text-slate-100">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Operator Review Queue</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Review reports flagged for low AI confidence or missing incident details.
            </p>
          </div>
          <span className="text-xs font-medium bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700">
            {pendingCount} pending review{pendingCount === 1 ? '' : 's'}
          </span>
        </div>

        {/* Empty State */}
        {!reviews?.length ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-200 text-sm">Review Queue Clear</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All incoming reports have been verified or met automated dispatch thresholds.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map(rev => {
              const confidence = rev.report?.ai_confidence != null ? rev.report.ai_confidence : 0.45;
              const confPct = Math.round(confidence * 100);
              const isCalling = activeCallId === rev.id;

              return (
                <div 
                  key={rev.id} 
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="font-semibold text-sm text-white">Report #{rev.report_id}</span>
                      <span className="text-xs text-slate-500">&middot; Verification required</span>
                    </div>

                    <div className="text-right">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        confPct < 60 ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {confPct}% Confidence
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  {rev.report && (
                    <div className="space-y-3 text-xs">
                      {/* Raw statement */}
                      <div className="bg-slate-800/40 rounded-lg p-3 text-slate-300 italic border-l-2 border-slate-600">
                        "{rev.report.raw_text || 'No spoken audio transcript recorded'}"
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                        <div className="bg-slate-800/30 rounded-lg p-2.5">
                          <span className="text-slate-500 block mb-0.5">Classification</span>
                          <span className="font-medium text-white">{rev.report.preliminary_type || 'Unclassified'}</span>
                          <div className="text-slate-400 mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{rev.report.extracted_location || 'Location unverified'}</span>
                          </div>
                        </div>

                        <div className="bg-slate-800/30 rounded-lg p-2.5">
                          <span className="text-slate-500 block mb-0.5">Distress Signal</span>
                          <span className="font-medium text-slate-200 capitalize">{rev.report.voice_distress_signal || 'None detected'}</span>
                          {rev.report.reporter_lat != null && (
                            <div className="text-slate-500 font-mono text-[11px] mt-1">
                              GPS: {rev.report.reporter_lat.toFixed(3)}, {rev.report.reporter_lng?.toFixed(3)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Missing info */}
                      {rev.report?.missing_info?.length ? (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex items-start gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <div className="text-amber-300 text-xs">
                            <span className="font-medium">Missing context: </span>
                            {rev.report.missing_info.map(m => m.replace(/_/g, ' ')).join(', ')}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => confirmMut.mutate(rev.id)} 
                        disabled={confirmMut.isPending}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Confirm & Dispatch</span>
                      </button>

                      <button 
                        onClick={() => rejectMut.mutate(rev.id)} 
                        disabled={rejectMut.isPending}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5 text-slate-400" />
                        <span>Dismiss</span>
                      </button>
                    </div>

                    <button 
                      onClick={() => callMut.mutate(rev.id)}
                      disabled={isCalling}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isCalling ? 'Calling...' : 'Call Reporter'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

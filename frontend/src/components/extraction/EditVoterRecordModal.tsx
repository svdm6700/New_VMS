import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { VoterRecord } from '../../types/document';
import { documentService } from '../../services/documentService';

interface EditVoterRecordModalProps {
  record: VoterRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedRecord: VoterRecord) => void;
}

export const EditVoterRecordModal: React.FC<EditVoterRecordModalProps> = ({
  record,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen || !record) return null;

  const [formData, setFormData] = useState<Partial<VoterRecord>>({
    serial_no: record.serial_no,
    electoral_roll_no: record.electoral_roll_no,
    voter_name: record.voter_name,
    relation_type: record.relation_type,
    relation_name: record.relation_name,
    age: record.age,
    gender: record.gender,
    house_no: record.house_no,
    voter_id: record.voter_id,
    source_page: record.source_page,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const updated = await documentService.updateVoterRecord(record.id, formData);
      onSaved(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update record in database.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              ఓటరు వివరాల సవరణ (Edit & Correct Record)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Record #{record.id} • గ్రా.పం. వరుస సంఖ్య: {record.serial_no}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                గ్రా.పం.ఓ.జా.వ.సం. (Serial No.)
              </label>
              <input
                type="text"
                value={formData.serial_no || ''}
                onChange={(e) => setFormData({ ...formData, serial_no: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                అ.ఓ.జా.వ.సం. (Electoral Roll No.)
              </label>
              <input
                type="text"
                value={formData.electoral_roll_no || ''}
                onChange={(e) => setFormData({ ...formData, electoral_roll_no: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              ఓటరు పేరు (Voter Name)
            </label>
            <input
              type="text"
              value={formData.voter_name || ''}
              onChange={(e) => setFormData({ ...formData, voter_name: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                సంబంధం (Relation Type)
              </label>
              <input
                type="text"
                value={formData.relation_type || ''}
                onChange={(e) => setFormData({ ...formData, relation_type: e.target.value })}
                placeholder="తండ్రి / భర్త"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                సంబంధిత వ్యక్తి పేరు (Relative Name)
              </label>
              <input
                type="text"
                value={formData.relation_name || ''}
                onChange={(e) => setFormData({ ...formData, relation_name: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                వయస్సు (Age)
              </label>
              <input
                type="text"
                value={formData.age || ''}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                లింగము (Gender)
              </label>
              <input
                type="text"
                value={formData.gender || ''}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                placeholder="స్త్రీ / పురుషుడు"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                మూల పుట (Page)
              </label>
              <input
                type="number"
                value={formData.source_page || 1}
                onChange={(e) => setFormData({ ...formData, source_page: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ఇంటి సంఖ్య (House No.)
              </label>
              <input
                type="text"
                value={formData.house_no || ''}
                onChange={(e) => setFormData({ ...formData, house_no: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ఓటరు ఐడి (Voter ID)
              </label>
              <input
                type="text"
                value={formData.voter_id || ''}
                onChange={(e) => setFormData({ ...formData, voter_id: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

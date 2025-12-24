'use client';

import { useState } from 'react';
import { createTournament } from '@/app/admin/actions';

export default function CreateTournamentForm() {
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    const payload = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      event_type: formData.get('event_type') as 'DECIMAL' | 'PREDICTION',
      target_date: formData.get('target_date') as string,
      prize_pool: formData.get('prize_pool') as string,
    };

    const res = await createTournament(payload);
    setLoading(false);
    if (res.error) {
      alert(res.error);
    } else {
      alert('Tournament Created Successfully!');
      setIsOpen(false);
      (e.target as HTMLFormElement).reset();
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="group relative px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all duration-300 hover:-translate-y-0.5"
      >
        <span className="flex items-center gap-2">
          <span className="text-xl">+</span> Create New Tournament
        </span>
      </button>
    );
  }

  return (
    <div className="bg-[#111315] border border-gray-800 rounded-2xl p-8 mb-12 shadow-xl">
      <div className="flex justify-between items-center mb-8 pb-6 border-b border-gray-800">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Create New Tournament</h2>
          <p className="text-gray-400 text-sm">Configure the details for the upcoming event.</p>
        </div>
        <button 
          onClick={() => setIsOpen(false)} 
          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Title</label>
            <input 
              name="title" 
              required 
              className="w-full bg-[#1A1D21] border border-gray-700/50 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
              placeholder="e.g. Samsung Weekly Prediction" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Prize Pool</label>
            <input 
              name="prize_pool" 
              required 
              className="w-full bg-[#1A1D21] border border-gray-700/50 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
              placeholder="e.g. 1,000,000 P" 
            />
          </div>
        </div>

        <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Description</label>
            <textarea 
              name="description" 
              className="w-full bg-[#1A1D21] border border-gray-700/50 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors min-h-[100px] resize-y" 
              placeholder="Enter the rules, winning conditions, and other details..." 
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Event Type</label>
            <div className="relative">
              <select 
                name="event_type" 
                className="w-full appearance-none bg-[#1A1D21] border border-gray-700/50 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
              >
                <option value="PREDICTION">Price Prediction (Type B)</option>
                <option value="DECIMAL">Decimal/Lotto (Type A)</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Target Date</label>
            <input 
              name="target_date" 
              type="datetime-local" 
              required 
              className="w-full bg-[#1A1D21] border border-gray-700/50 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors [color-scheme:dark]" 
            />
          </div>
        </div>

        <div className="pt-6 flex gap-4 border-t border-gray-800">
          <button 
            type="submit" 
            disabled={loading} 
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </span>
            ) : 'Create Tournament'}
          </button>
          <button 
            type="button" 
            onClick={() => setIsOpen(false)} 
            className="px-6 py-3 bg-[#1A1D21] hover:bg-gray-800 text-gray-300 font-medium rounded-lg border border-gray-700/50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import { updateConfigAction } from "./actions";

interface SystemConfig {
  key: string;
  value: string;
  description?: string;
  is_encrypted?: boolean;
  updated_at?: string;
  updated_by?: string;
}

export function ConfigManager({ initialConfigs }: { initialConfigs: SystemConfig[] }) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const handleEdit = (config: SystemConfig) => {
    setEditingKey(config.key);
    setEditValue(config.value);
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue("");
  };

  const handleSave = async (key: string) => {
    setLoading(true);
    const res = await updateConfigAction(key, editValue);
    setLoading(false);

    if (res.error) {
      alert(res.error);
      return;
    }

    setConfigs((prev) =>
      prev.map((c) => (c.key === key ? { ...c, value: editValue, updated_at: new Date().toISOString() } : c))
    );
    setEditingKey(null);
  };

  const filteredConfigs = configs.filter((c) =>
    c.key.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">System Configuration</h2>
        <input
          type="text"
          placeholder="Search keys..."
          className="p-2 border rounded bg-white text-gray-900"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-900">Key</th>
              <th className="px-4 py-3 font-medium text-gray-900">Value</th>
              <th className="px-4 py-3 font-medium text-gray-900 w-[150px]">Updated At</th>
              <th className="px-4 py-3 font-medium text-gray-900 w-[100px]">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {filteredConfigs.map((config) => {
              const isEditing = editingKey === config.key;
              const isSensitive = config.key.includes("KEY") || config.key.includes("SECRET") || config.key.includes("PASSWORD");

              return (
                <tr key={config.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{config.key}</td>
                  <td className="px-4 py-3 break-all text-gray-900">
                    {isEditing ? (
                      <input
                        type="text"
                        className="w-full p-1 border rounded text-gray-900"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                      />
                    ) : (
                      <span className={isSensitive ? "text-gray-500 italic" : "text-gray-900"}>
                        {isSensitive ? "••••••••" : config.value}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {config.updated_at ? new Date(config.updated_at).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleSave(config.key)}
                          disabled={loading}
                          className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancel}
                          disabled={loading}
                          className="bg-gray-200 text-gray-800 px-2 py-1 rounded hover:bg-gray-300 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(config)}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredConfigs.length === 0 && (
          <div className="p-8 text-center text-gray-500">No configurations found.</div>
        )}
      </div>
    </div>
  );
}

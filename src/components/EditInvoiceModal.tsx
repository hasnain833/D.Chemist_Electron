import { useState } from 'react';
import type { EditableInvoiceItem } from '../types/purchaseInvoice';
import { X, RefreshCcw } from 'lucide-react';

interface EditInvoiceModalProps {
  items: EditableInvoiceItem[];
  onClose: () => void;
  onSave: (items: EditableInvoiceItem[]) => void;
}

export default function EditInvoiceModal({ items: initialItems, onClose, onSave }: EditInvoiceModalProps) {
  const [items, setItems] = useState<EditableInvoiceItem[]>(initialItems);

  const handleChange = (index: number, field: keyof EditableInvoiceItem, value: string) => {
    const newItems = [...items];
    const item = { ...newItems[index] };

    if (field === 'editBatchNo') item.editBatchNo = value;
    else if (field === 'editQuantityText') {
      item.editQuantityText = value;
      item.editPackQuantity = parseInt(value) || 0;
      item.editTotalUnits = item.entryMode === 'Box'
        ? item.editPackQuantity * item.packetsPerBox * item.unitsPerPack
        : item.editPackQuantity;
    }
    else if (field === 'editTotalCostText') {
      item.editTotalCostText = value;
      item.editTotalCost = parseFloat(value.replace(/,/g, '')) || 0;
    }

    if (item.editTotalUnits > 0) {
      item.editUnitCost = item.editTotalCost / item.editTotalUnits;
    } else {
      item.editUnitCost = 0;
    }

    newItems[index] = item;
    setItems(newItems);
  };

  const handleRevert = (index: number) => {
    const newItems = [...items];
    const item = { ...newItems[index] };

    item.editBatchNo = item.originalBatchNo;
    item.editQuantityText = item.originalPackQuantity.toString();
    item.editTotalCostText = item.originalTotalCost.toFixed(2);

    item.editPackQuantity = item.originalPackQuantity;
    item.editTotalUnits = item.originalQuantityUnits;
    item.editTotalCost = item.originalTotalCost;
    item.editUnitCost = item.originalQuantityUnits > 0 ? item.originalTotalCost / item.originalQuantityUnits : 0;

    newItems[index] = item;
    setItems(newItems);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">

        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Edit Invoice Items</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-gray-50 dark:bg-gray-900/50">
          <table className="table w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th>Medicine Name</th>
                <th>Batch No</th>
                <th>Quantity</th>
                <th>Total Cost (PKR)</th>
                <th>Unit Cost</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.batchId}>
                  <td className="font-medium">{item.medicineName}</td>
                  <td>
                    <input
                      type="text"
                      className="input input-sm input-bordered w-32"
                      value={item.editBatchNo}
                      onChange={(e) => handleChange(idx, 'editBatchNo', e.target.value)}
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="input input-sm input-bordered w-24"
                        value={item.editQuantityText}
                        onChange={(e) => handleChange(idx, 'editQuantityText', e.target.value)}
                      />
                      <span className="text-xs text-gray-500">{item.entryMode === 'Box' ? 'Boxes' : 'Units'}</span>
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      className="input input-sm input-bordered w-32"
                      value={item.editTotalCostText}
                      onChange={(e) => handleChange(idx, 'editTotalCostText', e.target.value)}
                    />
                  </td>
                  <td className="text-gray-500">
                    {item.editUnitCost.toFixed(2)} / unit
                  </td>
                  <td>
                    <button
                      onClick={() => handleRevert(idx)}
                      className="btn btn-sm btn-ghost text-orange-500"
                      title="Revert to Original"
                    >
                      <RefreshCcw size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-4 bg-white dark:bg-gray-800 rounded-b-xl">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={() => onSave(items)} className="btn btn-primary">Save Changes</button>
        </div>

      </div>
    </div>
  );
}

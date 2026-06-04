import { useState, useEffect } from 'react';
import type { Medicine, Category, Manufacturer } from '../types/models';
import { Search, Edit3, Trash2, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';
import { useAuth } from '../AuthContext';

export default function Inventory() {
  const { user } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, [searchTerm]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = searchTerm.length > 0
        ? await window.electronAPI.dbQuery('medicines:search', { term: searchTerm })
        : await window.electronAPI.dbQuery('medicines:getAll');
      if (res.success) setMedicines(res.data);

      const [catRes, mfgRes] = await Promise.all([
        window.electronAPI.dbQuery('categories:getAll'),
        window.electronAPI.dbQuery('manufacturers:getAll')
      ]);
      if (catRes.success) setCategories(catRes.data);
      if (mfgRes.success) setManufacturers(mfgRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (med: Medicine) => {
    setEditForm({ ...med });
    setIsModalOpen(true);
  };

  const handleSaveEdit = async () => {
    const res = await window.electronAPI.dbQuery('medicines:update', editForm);
    if (res.success) {
      setIsModalOpen(false);
      fetchData();
      alert("Medicine information updated.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure? This will delete the medicine.")) return;
    const res = await window.electronAPI.dbQuery('medicines:delete', { id });
    if (res.success) fetchData();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-xl font-bold text-slate-800 border-l-4 border-emerald-600 pl-3">Medicine List</h1>
          <p className="text-slate-400 text-xs mt-1">View and manage all medicines.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search name or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-emerald-500 w-56 shadow-sm"
            />
          </div>
          <button onClick={fetchData} className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-emerald-600 shadow-sm transition-all">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-100 uppercase text-[9px] font-bold text-slate-400 tracking-wider">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Medicine Name</th>
              <th className="p-3">Category</th>
              <th className="p-3 text-center">Stock</th>
              <th className="p-3 text-right">Price</th>
              <th className="p-3 text-center">Expiry</th>
              <th className="p-3 text-right pr-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-xs">
            {medicines.map((med) => (
              <tr key={med.id} className="hover:bg-slate-50/50">
                <td className="p-3 font-mono text-[10px] text-slate-400">{med.id}</td>
                <td className="p-3">
                  <div className="font-bold text-slate-800">{med.name}</div>
                  <div className="text-[9px] text-slate-400 font-medium">{med.genericName} • {med.strength}</div>
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 bg-slate-100 font-bold text-slate-600 rounded text-[9px] uppercase">
                    {med.categoryName || 'General'}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <span className={`font-bold ${med.stockQty <= 10 ? 'text-rose-500' : 'text-emerald-600'}`}>
                    {med.stockQty} Units
                  </span>
                </td>
                <td className="p-3 text-right font-bold text-slate-900">PKR {med.sellingPrice?.toLocaleString()}</td>
                <td className="p-3 text-center text-[10px]">
                  {med.expiryDate ? (
                    <span className={new Date(med.expiryDate) < new Date() ? 'text-rose-500 font-bold' : 'text-slate-500 font-medium'}>
                      {new Date(med.expiryDate).toLocaleDateString()}
                    </span>
                  ) : <span className="text-slate-300">No Date</span>}
                </td>
                <td className="p-3 text-right pr-6">
                  <div className="flex justify-end gap-2 text-slate-400">
                    <button onClick={() => handleEditClick(med)} className="p-1 hover:text-emerald-600">
                      <Edit3 size={14} />
                    </button>
                    {user?.role === 'Admin' && (
                      <button onClick={() => handleDelete(med.id)} className="p-1 hover:text-rose-600">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {medicines.length === 0 && !isLoading && (
              <tr>
                <td colSpan={7} className="p-16 text-center text-slate-300">
                  <p className="text-[10px] font-bold uppercase tracking-wider">No medicines found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* EDIT MODAL */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Edit Medicine Detail">
        <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Medicine Name</label>
              <input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Generic Name</label>
              <input value={editForm.genericName || ''} onChange={e => setEditForm({ ...editForm, genericName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Barcode</label>
              <input value={editForm.barcode || ''} onChange={e => setEditForm({ ...editForm, barcode: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Category</label>
              <select value={editForm.categoryId || ''} onChange={e => setEditForm({ ...editForm, categoryId: parseInt(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-bold">
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Manufacturer</label>
              <select value={editForm.manufacturerId || ''} onChange={e => setEditForm({ ...editForm, manufacturerId: parseInt(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-bold">
                <option value="">Select Company</option>
                {manufacturers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Strength</label>
              <input value={editForm.strength || ''} onChange={e => setEditForm({ ...editForm, strength: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-bold" />
            </div>
          </div>
          <div className="pt-6 flex gap-3">
            <button type="submit" className="flex-1 bg-[#00167a] text-white py-3 rounded font-bold text-xs uppercase tracking-widest">Update Medicine</button>
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 border border-slate-200 rounded font-bold text-xs uppercase tracking-widest text-slate-400">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

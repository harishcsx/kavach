import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const ManufacturerDashboard = () => {
    const { token } = useAuth();
    const [containers, setContainers] = useState([]);
    const [newContainer, setNewContainer] = useState({ batchNumber: '', containerNumber: '' });
    const [permitHours, setPermitHours] = useState(24);

    useEffect(() => {
        fetchContainers();
    }, []);

    const fetchContainers = async () => {
        try {
            const { data } = await axios.get('http://localhost:5000/containers', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setContainers(data);
        } catch (e) { console.error(e) }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const { data } = await axios.post('http://localhost:5000/containers/create', newContainer, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(`Container Created! Secret Key (SAVE THIS for ESP32): ${data.secretKey}`);
            fetchContainers();
        } catch (e) { alert("Failed to create") }
    };

    const handleDispatch = async (id) => {
        try {
            await axios.post(`http://localhost:5000/containers/${id}/dispatch`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Dispatched");
            fetchContainers();
        } catch (e) { alert("Failed to dispatch") }
    };

    const handleGeneratePermit = async (id) => {
        try {
            const { data } = await axios.post(`http://localhost:5000/containers/${id}/permit`, { expiresInHours: permitHours }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(`Permit Generated. Token: ${data.token}`);
        } catch (e) { alert("Failed to generate permit") }
    };

    return (
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-xl shadow">
                <h2 className="text-xl font-bold mb-4">Register New Container</h2>
                <form onSubmit={handleCreate} className="flex gap-4 items-end">
                    <div>
                        <label className="block text-sm">Batch Number</label>
                        <input type="text" className="border p-2 rounded w-full" value={newContainer.batchNumber} onChange={e => setNewContainer({ ...newContainer, batchNumber: e.target.value })} required />
                    </div>
                    <div>
                        <label className="block text-sm">Container Number</label>
                        <input type="text" className="border p-2 rounded w-full" value={newContainer.containerNumber} onChange={e => setNewContainer({ ...newContainer, containerNumber: e.target.value })} required />
                    </div>
                    <button className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700">Register & Generate Key</button>
                </form>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
                <h2 className="text-xl font-bold mb-4">My Containers</h2>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 border-b">
                            <th className="p-2">Number</th>
                            <th className="p-2">Batch</th>
                            <th className="p-2">Status</th>
                            <th className="p-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {containers.map(c => (
                            <tr key={c.id} className="border-b">
                                <td className="p-2 text-blue-600 font-bold"><a href={`/container/${c.id}`}>{c.containerNumber}</a></td>
                                <td className="p-2">{c.batchNumber}</td>
                                <td className="p-2">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${c.status === 'MANUFACTURED' ? 'bg-yellow-200' : 'bg-blue-200'}`}>
                                        {c.status}
                                    </span>
                                </td>
                                <td className="p-2 space-x-2">
                                    {c.status === 'MANUFACTURED' && (
                                        <button onClick={() => handleDispatch(c.id)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Dispatch</button>
                                    )}
                                    {c.status === 'DISPATCHED' && (
                                        <button onClick={() => handleGeneratePermit(c.id)} className="bg-purple-600 text-white px-3 py-1 rounded text-sm">Gen Permit</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ManufacturerDashboard;

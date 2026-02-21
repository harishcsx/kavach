import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const ManufacturerDashboard = () => {
    const { token } = useAuth();
    const [containers, setContainers] = useState([]);
    const [newContainer, setNewContainer] = useState({ batchNumber: '', containerNumber: '' });
    const [permitHours, setPermitHours] = useState(24);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'RECEIVER' });

    useEffect(() => { fetchContainers(); }, []);

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
            alert(`Container Created!\n\nSecret Key (SAVE THIS for ESP32):\n${data.secretKey}`);
            setNewContainer({ batchNumber: '', containerNumber: '' });
            fetchContainers();
        } catch (e) { alert("Failed to create") }
    };

    const handleDispatch = async (id) => {
        try {
            await axios.post(`http://localhost:5000/containers/${id}/dispatch`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Dispatched!");
            fetchContainers();
        } catch (e) { alert("Failed to dispatch") }
    };

    const handleGeneratePermit = async (id) => {
        try {
            const { data } = await axios.post(`http://localhost:5000/containers/${id}/permit`, { expiresInHours: permitHours }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(`Permit Token:\n${data.token}`);
        } catch (e) { alert("Failed to generate permit") }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:5000/auth/register', newUser);
            alert(`Account created!\n\nEmail: ${newUser.email}\nPassword: ${newUser.password}\nRole: ${newUser.role}\n\nShare these credentials with the ${newUser.role.toLowerCase()}.`);
            setNewUser({ name: '', email: '', password: '', role: 'RECEIVER' });
        } catch (e) {
            alert(e.response?.data?.error || "Failed to create account");
        }
    };

    return (
        <div>
            {/* Create Receiver/Vendor Account */}
            <div className="card card--purple-border">
                <h2 className="card-title">👤 Create Receiver / Vendor Account</h2>
                <form onSubmit={handleCreateUser} className="form-row">
                    <div className="form-group">
                        <label>Full Name</label>
                        <input type="text" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                        <label>Email</label>
                        <input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input type="text" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required />
                    </div>
                    <div className="form-group" style={{ maxWidth: 180 }}>
                        <label>Role</label>
                        <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} style={{
                            width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px',
                            fontSize: '0.95rem', fontFamily: 'inherit', background: '#fafafa', outline: 'none'
                        }}>
                            <option value="RECEIVER">Receiver</option>
                            <option value="ENFORCEMENT">Enforcement</option>
                        </select>
                    </div>
                    <button className="btn btn-purple" type="submit">Create Account</button>
                </form>
            </div>

            {/* Register New Container */}
            <div className="card">
                <h2 className="card-title">📦 Register New Container</h2>
                <form onSubmit={handleCreate} className="form-row">
                    <div className="form-group">
                        <label>Batch Number</label>
                        <input type="text" value={newContainer.batchNumber} onChange={e => setNewContainer({ ...newContainer, batchNumber: e.target.value })} required />
                    </div>
                    <div className="form-group">
                        <label>Container Number</label>
                        <input type="text" value={newContainer.containerNumber} onChange={e => setNewContainer({ ...newContainer, containerNumber: e.target.value })} required />
                    </div>
                    <button className="btn btn-green" type="submit">Register & Generate Key</button>
                </form>
            </div>

            {/* Container Table */}
            <div className="card">
                <h2 className="card-title">📋 My Containers</h2>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Number</th>
                                <th>Batch</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {containers.map(c => (
                                <tr key={c.id}>
                                    <td><a href={`/container/${c.id}`} className="link">{c.containerNumber}</a></td>
                                    <td>{c.batchNumber}</td>
                                    <td>
                                        <span className={`badge ${c.status === 'MANUFACTURED' ? 'badge-yellow' : c.status === 'DELIVERED' ? 'badge-green' : 'badge-blue'}`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="btn-group">
                                            {c.status === 'MANUFACTURED' && (
                                                <button onClick={() => handleDispatch(c.id)} className="btn btn-primary btn-sm">Dispatch</button>
                                            )}
                                            {c.status === 'DISPATCHED' && (
                                                <button onClick={() => handleGeneratePermit(c.id)} className="btn btn-purple btn-sm">Gen Permit</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {containers.length === 0 && (
                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>No containers registered yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ManufacturerDashboard;

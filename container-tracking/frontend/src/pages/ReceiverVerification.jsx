import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const ReceiverVerification = () => {
    const { token, user } = useAuth();
    const [permitToken, setPermitToken] = useState('');
    const [sessionToken, setSessionToken] = useState('');
    const [containerId, setContainerId] = useState('');
    const [rfidUid, setRfidUid] = useState('');
    const [statusMsg, setStatusMsg] = useState('');

    const handleActivate = async (e) => {
        e.preventDefault();
        try {
            const { data } = await axios.post('http://localhost:5000/receiver/activate', { permitToken }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSessionToken(data.sessionToken);
            setContainerId(data.containerId);
            setStatusMsg(data.message);
        } catch (e) {
            setStatusMsg(e.response?.data?.error || "Activation failed");
        }
    };

    const handleScan = async (e) => {
        e.preventDefault();
        try {
            // In a real app, the sessionToken would be sent instead of the base user token,
            // but for demo, we'll authenticate the receiver via the base token and pass containerId in body
            const { data } = await axios.post('http://localhost:5000/receiver/scan', { containerId, rfidUid }, {
                headers: { Authorization: `Bearer ${token}` } // Simplified for demo
            });
            setStatusMsg(`Success! ${data.message} TxHash: ${data.txHash}`);
        } catch (e) {
            setStatusMsg(`REJECTED! ${e.response?.data?.error}`);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl shadow border-l-4 border-blue-500">
                <h2 className="text-xl font-bold mb-4">Step 1: Activate Delivery Permit</h2>
                <form onSubmit={handleActivate} className="flex gap-4">
                    <input type="text" placeholder="Enter Permit Token" className="border p-2 rounded w-full"
                        value={permitToken} onChange={e => setPermitToken(e.target.value)} required />
                    <button className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700">Activate</button>
                </form>
            </div>

            {sessionToken && (
                <div className="bg-white p-6 rounded-xl shadow border-l-4 border-purple-500">
                    <h2 className="text-xl font-bold mb-4">Step 2: Scan Container RFID</h2>
                    <form onSubmit={handleScan} className="flex gap-4">
                        <input type="text" placeholder="Simulate RFID UID Scan" className="border p-2 rounded w-full"
                            value={rfidUid} onChange={e => setRfidUid(e.target.value)} required />
                        <button className="bg-purple-600 text-white px-4 py-2 rounded font-bold hover:bg-purple-700">Verify</button>
                    </form>
                </div>
            )}

            {statusMsg && (
                <div className={`p-4 rounded font-bold ${statusMsg.includes('REJECTED') ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}`}>
                    {statusMsg}
                </div>
            )}
        </div>
    );
};

export default ReceiverVerification;

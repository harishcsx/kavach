import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const ReceiverVerification = () => {
    const { token } = useAuth();
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
            const { data } = await axios.post('http://localhost:5000/receiver/scan', { containerId, rfidUid }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStatusMsg(`Success! ${data.message} TxHash: ${data.txHash}`);
        } catch (e) {
            setStatusMsg(`REJECTED! ${e.response?.data?.error}`);
        }
    };

    return (
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div className="card card--blue-border">
                <h2 className="card-title">Step 1: Activate Delivery Permit</h2>
                <form onSubmit={handleActivate} className="form-row">
                    <div className="form-group">
                        <input type="text" placeholder="Enter Permit Token" value={permitToken} onChange={e => setPermitToken(e.target.value)} required />
                    </div>
                    <button className="btn btn-primary" type="submit">Activate</button>
                </form>
            </div>

            {sessionToken && (
                <div className="card card--purple-border">
                    <h2 className="card-title">Step 2: Scan Container RFID</h2>
                    <form onSubmit={handleScan} className="form-row">
                        <div className="form-group">
                            <input type="text" placeholder="Simulate RFID UID Scan" value={rfidUid} onChange={e => setRfidUid(e.target.value)} required />
                        </div>
                        <button className="btn btn-purple" type="submit">Verify</button>
                    </form>
                </div>
            )}

            {statusMsg && (
                <div className={`status-msg ${statusMsg.includes('REJECTED') ? 'status-msg--error' : 'status-msg--success'}`}>
                    {statusMsg}
                </div>
            )}
        </div>
    );
};

export default ReceiverVerification;

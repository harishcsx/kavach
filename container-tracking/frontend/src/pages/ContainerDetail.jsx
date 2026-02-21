import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

const ContainerDetail = () => {
    const { id } = useParams();
    const { token } = useAuth();
    const [container, setContainer] = useState(null);

    useEffect(() => {
        const fetchContainer = async () => {
            try {
                const { data } = await axios.get(`http://localhost:5000/containers/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setContainer(data);
            } catch (e) {
                console.error(e);
            }
        };
        fetchContainer();
    }, [id, token]);

    if (!container) return <div className="loading">Loading container data...</div>;

    return (
        <div>
            <div className="card">
                <div className="info-grid">
                    <div className="info-item">
                        <h3>Container Number</h3>
                        <p>{container.containerNumber}</p>
                    </div>
                    <div className="info-item">
                        <h3>Status</h3>
                        <span className="status-badge">{container.status}</span>
                    </div>
                    <div className="info-item">
                        <h3>Batch</h3>
                        <p>{container.batchNumber}</p>
                    </div>
                </div>
            </div>

            <div className="card">
                <h2 className="card-title">📜 Event Ledger</h2>
                <div className="ledger-scroll">
                    {container.events.map(ev => (
                        <div key={ev.id} className="ledger-item">
                            <span className="ledger-date">{format(new Date(ev.createdAt), 'dd MMM yyyy, HH:mm')}</span>
                            <div className="ledger-type">{ev.eventType}</div>
                            <div className="ledger-desc">{ev.description}</div>
                            {ev.txHash && <a href={`https://etherscan.io/tx/${ev.txHash}`} target="_blank" rel="noreferrer" className="ledger-tx">Tx: {ev.txHash}</a>}
                        </div>
                    ))}
                    {container.events.length === 0 && <p style={{ color: '#9ca3af', textAlign: 'center', padding: '32px' }}>No events logged.</p>}
                </div>
            </div>
        </div>
    );
};

export default ContainerDetail;

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

    if (!container) return <div className="p-8 text-center text-gray-500">Loading container data...</div>;

    return (
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-xl shadow grid grid-cols-3 gap-4">
                <div>
                    <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Container Number</h3>
                    <p className="text-2xl font-bold">{container.containerNumber}</p>
                </div>
                <div>
                    <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Status</h3>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded font-bold text-lg mt-1 inline-block">{container.status}</span>
                </div>
                <div>
                    <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Batch</h3>
                    <p className="text-lg font-medium">{container.batchNumber}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">

                <div className="bg-white p-6 rounded-xl shadow h-96 overflow-y-auto">
                    <h3 className="text-xl font-bold mb-4">Event Ledger</h3>
                    <ul className="space-y-4">
                        {container.events.map(ev => (
                            <li key={ev.id} className="border-l-4 border-blue-500 pl-4 py-1">
                                <span className="text-xs font-bold text-gray-500 uppercase">{format(new Date(ev.createdAt), 'dd MMM yyyy, HH:mm')}</span>
                                <p className="font-bold text-lg text-gray-800">{ev.eventType}</p>
                                <p className="text-gray-700">{ev.description}</p>
                                {ev.txHash && <a href={`https://etherscan.io/tx/${ev.txHash}`} target="_blank" rel="noreferrer" className="text-xs text-blue-500 overflow-hidden text-ellipsis block w-full mt-1">Tx: {ev.txHash}</a>}
                            </li>
                        ))}
                        {container.events.length === 0 && <p className="text-gray-500">No events logged.</p>}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default ContainerDetail;

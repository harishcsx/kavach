import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { format } from 'date-fns';

const EnforcementMonitor = () => {
    const socket = useSocket();
    const [alerts, setAlerts] = useState([]);

    useEffect(() => {
        if (!socket) return;
        socket.on('tamperAlerts', (data) => {
            setAlerts(prev => [data, ...prev]);
        });

        return () => socket.off('tamperAlerts');
    }, [socket]);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-red-600 flex items-center gap-2">
                🔴 Live Tamper Alerts
            </h2>

            <div className="bg-white rounded-xl shadow overflow-hidden">
                {alerts.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 font-medium">Listening for live alerts from IoT containers... No anomalies detected.</div>
                ) : (
                    <ul className="divide-y divide-gray-200">
                        {alerts.map((alert, i) => (
                            <li key={i} className="p-4 bg-red-50 hover:bg-red-100 transition">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-red-800 text-lg">Container: {alert.containerNumber}</h3>
                                        <p className="text-red-700"><strong>Reason:</strong> {alert.reason}</p>
                                        <a href={`/container/${alert.containerId}`} className="text-blue-600 underline text-sm mt-2 inline-block">View History</a>
                                    </div>
                                    <div className="text-sm font-bold text-gray-500">
                                        {format(new Date(alert.timestamp), 'HH:mm:ss dd/MMM')}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default EnforcementMonitor;

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
        <div>
            <div className="alert-header">🔴 Live Tamper Alerts</div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {alerts.length === 0 ? (
                    <div className="alert-empty">Listening for live alerts from IoT containers... No anomalies detected.</div>
                ) : (
                    <div>
                        {alerts.map((alert, i) => (
                            <div key={i} className="alert-item">
                                <div>
                                    <h3>Container: {alert.containerNumber}</h3>
                                    <p><strong>Reason:</strong> {alert.reason}</p>
                                    <a href={`/container/${alert.containerId}`}>View History →</a>
                                </div>
                                <div className="alert-time">
                                    {format(new Date(alert.timestamp), 'HH:mm:ss dd/MMM')}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnforcementMonitor;

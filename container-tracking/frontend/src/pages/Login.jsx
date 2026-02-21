import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const success = await login(email, password);
        if (success) {
            setTimeout(() => navigate('/manufacturer'), 500);
        } else {
            alert("Login failed");
        }
    };

    return (
        <div className="login-wrapper">
            <div className="login-card">
                <h2>🔐 System Login</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    </div>
                    <button className="btn btn-primary" type="submit">Sign In</button>
                    <p style={{ textAlign: 'center', marginTop: '16px', color: '#6b7280', fontSize: '0.9rem' }}>
                        Don't have an account? <a href="/register" className="link">Sign up</a>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Login;
